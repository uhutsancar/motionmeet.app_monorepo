import { sql } from "kysely";
import type { Comment, Post } from "@motionmeet/shared";
import { database, withTransaction, type DatabaseTransaction } from "../configs/database.js";
import { invalidateOwnFeed } from "./feedCache.js";
import { publicUser } from "../repositories/postRepository.js";
import { toIsoString } from "../repositories/entities.js";
import * as notificationService from "./notificationService.js";
import { getRelationshipMap } from "./relationshipService.js";
import { createCursor, type Pagination } from "../utils/pagination.js";

/**
 * How many comments ride along with a post in a list response.
 *
 * A feed page is 30 posts, so 20 previews meant every feed request carried up
 * to 600 comment rows and the author record behind each one - for a card that
 * shows three. Both clients already page the rest in through
 * `comment_next_cursor` and `GET /api/post/:postId/comments`, so the deeper
 * ones cost nothing until somebody opens the thread.
 */
const COMMENT_PREVIEW_LIMIT = 3;

export const hydratePostInteractions = async (posts: Post[], requesterId: string | undefined, previewLimit = COMMENT_PREVIEW_LIMIT): Promise<Post[]> => {
  const postIds = posts.map((post) => post.id);
  if (!postIds.length) return posts;
  const authorIds = [...new Set(posts.map((post) => typeof post.user === "string" ? post.user : post.user.id))];
  const rankedComments = database.selectFrom("post_comments").selectAll()
    .select(sql<number>`row_number() over (partition by post_id order by created_at desc, id desc)`.as("post_rank"))
    .where("post_id", "in", postIds).as("ranked_comments");
  const [likes, relationships, commentRows] = await Promise.all([
    requesterId ? database.selectFrom("post_likes").select("post_id").where("post_id", "in", postIds).where("user_id", "=", requesterId).execute() : [],
    requesterId && authorIds.length ? getRelationshipMap(requesterId, authorIds) : new Map(),
    database.selectFrom(rankedComments).select(["id", "post_id", "user_id", "content", "created_at", "updated_at"]).where("post_rank", "<=", previewLimit).execute(),
  ]);
  const userIds = [...new Set(commentRows.map((comment) => comment.user_id))];
  const users = userIds.length ? await database.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url"]).where("id", "in", userIds).execute() : [];
  const userById = new Map(users.map((user) => [user.id, publicUser(user.id, user.full_name, user.username, user.profile_picture_url)]));
  const commentsByPost = new Map<string, Comment[]>();
  for (const row of commentRows) {
    const comment: Comment = { id: row.id, _id: row.id, postId: row.post_id, content: row.content, user: userById.get(row.user_id) ?? null, createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(), updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString() };
    commentsByPost.set(row.post_id, [...(commentsByPost.get(row.post_id) ?? []), comment]);
  }
  const liked = new Set(likes.map((entry) => entry.post_id));
  return posts.map((post) => {
    const comments = (commentsByPost.get(post.id) ?? []).sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    const authorId = typeof post.user === "string" ? post.user : post.user.id;
    const relationship = relationships.get(authorId);
    return {
      ...post,
      liked_by_me: liked.has(post.id),
      author_followed_by_me: Boolean(relationship?.isFollowing),
      // Lets the feed card show "İstek gönderildi" instead of offering Follow
      // again on an account that has not answered yet.
      author_follow_requested: Boolean(relationship?.requestSent),
      author_follows_me: Boolean(relationship?.isFollowedBy),
      comments,
      comment_next_cursor: post.comment_count > comments.length && comments[0] ? createCursor(comments[0]) : null,
    };
  });
};

const postCount = async (postId: string, transaction: DatabaseTransaction): Promise<number> => Number((await transaction.selectFrom("posts").select("like_count").where("id", "=", postId).executeTakeFirst())?.like_count ?? 0);

/**
 * Applies the delta and reads the result back in the same statement.
 *
 * The pair used to be an `UPDATE` followed by a `SELECT like_count`, which cost
 * a second round trip on the hottest write in the product for a value the
 * `UPDATE` already had in hand.
 */
const applyLikeCount = async (postId: string, delta: 1 | -1, transaction: DatabaseTransaction): Promise<number> => {
  const row = await transaction.updateTable("posts")
    .set((expression) => ({ like_count: delta === 1 ? expression("like_count", "+", 1) : expression.fn<number>("greatest", [expression("like_count", "-", 1), expression.val(0)]) }))
    .where("id", "=", postId).returning("like_count").executeTakeFirst();
  return Number(row?.like_count ?? 0);
};

/**
 * The row is already durable when this runs, and the recipient may not even be
 * connected. Awaiting the fan-out would put `hydrate` plus an unread `COUNT` -
 * three queries - in front of the HTTP response for every like in the system,
 * so the write is awaited and the delivery is not.
 */
const notifyPostLike = async (authorId: string, actorId: string, postId: string): Promise<void> => {
  const row = await notificationService.recordNotification({ userId: authorId, actorId, type: "post_like", postId });
  void notificationService.publishNotification(row);
};

export const togglePostLike = async (postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> => {
  const result = await withTransaction(async (transaction) => {
    // No `FOR UPDATE`: `post_likes` has a composite primary key, so the insert
    // is the thing that decides a duplicate, and the counter moves with an
    // atomic delta. Locking the post row instead made every like on a popular
    // post queue behind the one before it.
    const post = await transaction.selectFrom("posts").select(["id", "user_id"]).where("id", "=", postId).executeTakeFirst();
    if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });
    const removed = await transaction.deleteFrom("post_likes").where("post_id", "=", postId).where("user_id", "=", userId).returning("post_id").executeTakeFirst();
    if (removed) return { liked: false, likeCount: await applyLikeCount(postId, -1, transaction), authorId: post.user_id };
    const inserted = await transaction.insertInto("post_likes").values({ post_id: postId, user_id: userId }).onConflict((conflict) => conflict.columns(["post_id", "user_id"]).doNothing()).returning("post_id").executeTakeFirst();
    const likeCount = inserted ? await applyLikeCount(postId, 1, transaction) : await postCount(postId, transaction);
    return { liked: true, likeCount, authorId: post.user_id };
  });
  await invalidateOwnFeed(userId);
  if (result.liked) await notifyPostLike(result.authorId, userId, postId);
  return { liked: result.liked, likeCount: result.likeCount };
};

export const likePost = async (postId: string, userId: string): Promise<{ liked: true; likeCount: number }> => {
  const result = await withTransaction(async (transaction) => {
    const post = await transaction.selectFrom("posts").select(["id", "user_id"]).where("id", "=", postId).executeTakeFirst();
    if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });
    const inserted = await transaction.insertInto("post_likes").values({ post_id: postId, user_id: userId }).onConflict((conflict) => conflict.columns(["post_id", "user_id"]).doNothing()).returning("post_id").executeTakeFirst();
    const likeCount = inserted ? await applyLikeCount(postId, 1, transaction) : await postCount(postId, transaction);
    return { likeCount, authorId: post.user_id, isNew: Boolean(inserted) };
  });
  await invalidateOwnFeed(userId);
  // Outside the transaction: the like is already durable, and a delivery hiccup
  // must not undo it.
  if (result.isNew) await notifyPostLike(result.authorId, userId, postId);
  return { liked: true, likeCount: result.likeCount };
};

export const unlikePost = async (postId: string, userId: string): Promise<{ liked: false; likeCount: number }> => {
  const likeCount = await withTransaction(async (transaction) => {
    const removed = await transaction.deleteFrom("post_likes").where("post_id", "=", postId).where("user_id", "=", userId).returning("post_id").executeTakeFirst();
    return removed ? applyLikeCount(postId, -1, transaction) : postCount(postId, transaction);
  });
  await invalidateOwnFeed(userId); return { liked: false, likeCount };
};

export const createPostComment = async (postId: string, userId: string, content: string): Promise<{ comment: Comment; commentCount: number }> => {
  let authorId = "";
  const result = await withTransaction(async (transaction) => {
    // Read without a row lock: the insert stands on its own and the counter is
    // an atomic delta, so holding the post row only queued concurrent comments
    // on a busy post behind each other.
    const post = await transaction.selectFrom("posts").select(["id", "user_id"]).where("id", "=", postId).executeTakeFirst();
    if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });
    authorId = post.user_id;
    const row = await transaction.insertInto("post_comments").values({ legacy_mongo_id: null, post_id: postId, user_id: userId, content: content.trim() }).returningAll().executeTakeFirstOrThrow();
    const countRow = await transaction.updateTable("posts").set((expression) => ({ comment_count: expression("comment_count", "+", 1) })).where("id", "=", postId).returning("comment_count").executeTakeFirstOrThrow();
    const user = await transaction.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url"]).where("id", "=", userId).executeTakeFirst();
    return { comment: { id: row.id, _id: row.id, postId, content: row.content, user: user ? publicUser(user.id, user.full_name, user.username, user.profile_picture_url) : null, createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(), updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString() }, commentCount: countRow.comment_count };
  });
  await invalidateOwnFeed(userId);
  // Durable first, delivered after the response - same reasoning as a like.
  void notificationService.publishNotification(
    await notificationService.recordNotification({ userId: authorId, actorId: userId, type: "post_comment", postId }),
  );
  return result;
};

export const getPostComments = async (postId: string, pagination: Pagination): Promise<{ items: Comment[]; nextCursor: string | null }> => {
  let query = database.selectFrom("post_comments").selectAll().where("post_id", "=", postId);
  if (pagination.cursor) query = query.where((expression) => expression.or([expression("created_at", "<", pagination.cursor!.date), expression.and([expression("created_at", "=", pagination.cursor!.date), expression("id", "<", pagination.cursor!.id)])]));
  const rows = await query.orderBy("created_at", "desc").orderBy("id", "desc").limit(pagination.limit + 1).execute();
  const hasMore = rows.length > pagination.limit; const selected = hasMore ? rows.slice(0, pagination.limit) : rows;
  const userIds = [...new Set(selected.map((row) => row.user_id))];
  const users = userIds.length ? await database.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url"]).where("id", "in", userIds).execute() : [];
  const userById = new Map(users.map((user) => [user.id, publicUser(user.id, user.full_name, user.username, user.profile_picture_url)]));
  const items: Comment[] = selected.map((row) => ({ id: row.id, _id: row.id, postId: row.post_id, content: row.content, user: userById.get(row.user_id) ?? null, createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(), updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString() }));
  return { items, nextCursor: hasMore && items.at(-1) ? createCursor(items.at(-1)!) : null };
};

export const deleteInteractionsForPost = async (postId: string, { transaction }: { transaction?: DatabaseTransaction } = {}): Promise<void> => {
  const executor = transaction ?? database;
  await executor.deleteFrom("post_comments").where("post_id", "=", postId).execute();
  await executor.deleteFrom("post_likes").where("post_id", "=", postId).execute();
};
