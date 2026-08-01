import { sql } from "kysely";
import type { Comment, Post } from "@motionmeet/shared";
import { database, withTransaction, type DatabaseTransaction } from "../configs/database.js";
import { invalidateCachePrefix } from "../configs/redis.js";
import { publicUser } from "../repositories/postRepository.js";
import { toIsoString } from "../repositories/entities.js";
import { createCursor, type Pagination } from "../utils/pagination.js";

const COMMENT_PREVIEW_LIMIT = 20;

export const hydratePostInteractions = async (posts: Post[], requesterId: string | undefined, previewLimit = COMMENT_PREVIEW_LIMIT): Promise<Post[]> => {
  const postIds = posts.map((post) => post.id);
  if (!postIds.length) return posts;
  const authorIds = [...new Set(posts.map((post) => typeof post.user === "string" ? post.user : post.user.id))];
  const rankedComments = database.selectFrom("post_comments").selectAll()
    .select(sql<number>`row_number() over (partition by post_id order by created_at desc, id desc)`.as("post_rank"))
    .where("post_id", "in", postIds).as("ranked_comments");
  const [likes, follows, commentRows] = await Promise.all([
    requesterId ? database.selectFrom("post_likes").select("post_id").where("post_id", "in", postIds).where("user_id", "=", requesterId).execute() : [],
    requesterId && authorIds.length ? database.selectFrom("user_follows").select("followee_id").where("follower_id", "=", requesterId).where("followee_id", "in", authorIds).execute() : [],
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
  const liked = new Set(likes.map((entry) => entry.post_id)); const followed = new Set(follows.map((entry) => entry.followee_id));
  return posts.map((post) => {
    const comments = (commentsByPost.get(post.id) ?? []).sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    const authorId = typeof post.user === "string" ? post.user : post.user.id;
    return { ...post, liked_by_me: liked.has(post.id), author_followed_by_me: followed.has(authorId), comments, comment_next_cursor: post.comment_count > comments.length && comments[0] ? createCursor(comments[0]) : null };
  });
};

const postCount = async (postId: string, transaction: DatabaseTransaction): Promise<number> => Number((await transaction.selectFrom("posts").select("like_count").where("id", "=", postId).executeTakeFirst())?.like_count ?? 0);
const updateLikeCount = async (postId: string, delta: 1 | -1, transaction: DatabaseTransaction): Promise<void> => {
  await transaction.updateTable("posts").set((expression) => ({ like_count: delta === 1 ? expression("like_count", "+", 1) : expression.fn<number>("greatest", [expression("like_count", "-", 1), expression.val(0)]) })).where("id", "=", postId).execute();
};

export const togglePostLike = async (postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> => {
  const result = await withTransaction(async (transaction) => {
    const post = await transaction.selectFrom("posts").select("id").where("id", "=", postId).forUpdate().executeTakeFirst();
    if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });
    const removed = await transaction.deleteFrom("post_likes").where("post_id", "=", postId).where("user_id", "=", userId).returning("post_id").executeTakeFirst();
    if (removed) { await updateLikeCount(postId, -1, transaction); return { liked: false, likeCount: await postCount(postId, transaction) }; }
    await transaction.insertInto("post_likes").values({ post_id: postId, user_id: userId }).execute();
    await updateLikeCount(postId, 1, transaction);
    return { liked: true, likeCount: await postCount(postId, transaction) };
  });
  await invalidateCachePrefix("feed:"); return result;
};

export const likePost = async (postId: string, userId: string): Promise<{ liked: true; likeCount: number }> => {
  const likeCount = await withTransaction(async (transaction) => {
    const post = await transaction.selectFrom("posts").select("id").where("id", "=", postId).forUpdate().executeTakeFirst();
    if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });
    const inserted = await transaction.insertInto("post_likes").values({ post_id: postId, user_id: userId }).onConflict((conflict) => conflict.columns(["post_id", "user_id"]).doNothing()).returning("post_id").executeTakeFirst();
    if (inserted) await updateLikeCount(postId, 1, transaction);
    return postCount(postId, transaction);
  });
  await invalidateCachePrefix("feed:"); return { liked: true, likeCount };
};

export const unlikePost = async (postId: string, userId: string): Promise<{ liked: false; likeCount: number }> => {
  const likeCount = await withTransaction(async (transaction) => {
    const removed = await transaction.deleteFrom("post_likes").where("post_id", "=", postId).where("user_id", "=", userId).returning("post_id").executeTakeFirst();
    if (removed) await updateLikeCount(postId, -1, transaction);
    return postCount(postId, transaction);
  });
  await invalidateCachePrefix("feed:"); return { liked: false, likeCount };
};

export const createPostComment = async (postId: string, userId: string, content: string): Promise<{ comment: Comment; commentCount: number }> => {
  const result = await withTransaction(async (transaction) => {
    const post = await transaction.selectFrom("posts").select("id").where("id", "=", postId).forUpdate().executeTakeFirst();
    if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });
    const row = await transaction.insertInto("post_comments").values({ legacy_mongo_id: null, post_id: postId, user_id: userId, content: content.trim() }).returningAll().executeTakeFirstOrThrow();
    const countRow = await transaction.updateTable("posts").set((expression) => ({ comment_count: expression("comment_count", "+", 1) })).where("id", "=", postId).returning("comment_count").executeTakeFirstOrThrow();
    const user = await transaction.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url"]).where("id", "=", userId).executeTakeFirst();
    return { comment: { id: row.id, _id: row.id, postId, content: row.content, user: user ? publicUser(user.id, user.full_name, user.username, user.profile_picture_url) : null, createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(), updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString() }, commentCount: countRow.comment_count };
  });
  await invalidateCachePrefix("feed:"); return result;
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
