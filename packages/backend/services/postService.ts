import type { Post, PostType, PostVisibility } from "@motionmeet/shared";
import { sql } from "kysely";
import { database, withTransaction } from "../configs/database.js";
import { getCachedJson, invalidateCachePrefix, setCachedJson } from "../configs/redis.js";
import { findHydratedPost, findPostAccessRecord, hydratePosts, type PostAccessRecord } from "../repositories/postRepository.js";
import type { Pagination } from "../utils/pagination.js";
import { commitReservedUploads } from "./mediaUploadService.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";
import { createPostComment, deleteInteractionsForPost, getPostComments, hydratePostInteractions, likePost, togglePostLike, unlikePost } from "./postInteractionService.js";
import * as quotaService from "./quotaService.js";

export const canAccessPost = async (post: PostAccessRecord, requester: { _id: string }): Promise<boolean> => {
  const requesterId = requester._id;
  if (post.user === requesterId || post.visibility === "public") return true;
  if (post.visibility !== "followers") return false;
  const pairKey = [post.user, requesterId].sort().join(":");
  const [follow, connection] = await Promise.all([
    database.selectFrom("user_follows").select("follower_id").where("follower_id", "=", requesterId).where("followee_id", "=", post.user).executeTakeFirst(),
    database.selectFrom("connections").select("id").where("pair_key", "=", pairKey).where("status", "=", "accepted").executeTakeFirst(),
  ]);
  return Boolean(follow || connection);
};

export const checkWorkoutExists = async (workoutId: string, userId: string): Promise<boolean> => Boolean(await database.selectFrom("workouts").select("id").where("id", "=", workoutId).where("user_id", "=", userId).executeTakeFirst());

export const findPostByOperation = async (userId: string, operationId: string): Promise<Post | null> => {
  const row = await database.selectFrom("posts").select("id").where("user_id", "=", userId).where("operation_id", "=", operationId).executeTakeFirst();
  return row ? findHydratedPost(row.id) : null;
};

interface NewPostInput { user: string; operationId: string; content: string; image_urls: string[]; image_keys: string[]; post_type: PostType; visibility: PostVisibility; workout?: string }
const isUniqueViolation = (error: unknown): boolean => Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");

export const createPost = async (input: NewPostInput, { quotaLimit = -1, reservationKeys = [] }: { quotaLimit?: number; reservationKeys?: string[] } = {}): Promise<Post> => {
  try {
    const post = await withTransaction(async (transaction) => {
      const existing = await transaction.selectFrom("posts").select("id").where("user_id", "=", input.user).where("operation_id", "=", input.operationId).executeTakeFirst();
      if (existing) {
        const hydrated = await findHydratedPost(existing.id, transaction);
        if (!hydrated) throw new Error("Idempotent post record is inconsistent");
        return hydrated;
      }
      const user = await transaction.selectFrom("users").select(["full_name", "username", "profile_picture_url"]).where("id", "=", input.user).executeTakeFirstOrThrow();
      if (quotaLimit !== -1) {
        const now = new Date(); const dayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
        const reserved = await quotaService.reserveQuota({ userId: input.user, bucket: quotaService.dailyBucket("posts", now), limit: quotaLimit, getCurrentCount: async () => Number((await transaction.selectFrom("posts").select((expression) => expression.fn.countAll<number>().as("count")).where("user_id", "=", input.user).where("created_at", ">=", dayStart).executeTakeFirst())?.count ?? 0), transaction, expiresAt: quotaService.shortLivedUsageExpiry(now) });
        if (!reserved) throw Object.assign(new Error(`Daily post limit reached (${quotaLimit})`), { status: 403 });
      }
      const row = await transaction.insertInto("posts").values({
        legacy_mongo_id: null, user_id: input.user, operation_id: input.operationId,
        author_full_name: user.full_name, author_username: user.username, author_profile_picture: user.profile_picture_url,
        content: input.content, post_type: input.post_type, visibility: input.visibility, workout_id: input.workout ?? null,
      }).returningAll().executeTakeFirstOrThrow();
      for (const [position, url] of input.image_urls.entries()) await transaction.insertInto("post_media").values({
        legacy_mongo_id: null, post_id: row.id, position, url, object_key: input.image_keys[position] ?? "",
        media_type: input.post_type === "video" ? "video" : "image", mime_type: input.post_type === "video" ? "video/mp4" : "image/*",
        file_size: null, width: null, height: null, duration_seconds: null,
      }).execute();
      await commitReservedUploads(reservationKeys, { transaction, userId: input.user });
      const hydrated = await findHydratedPost(row.id, transaction);
      if (!hydrated) throw new Error("Created post could not be loaded");
      return hydrated;
    });
    await invalidateCachePrefix("feed:");
    return post;
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await findPostByOperation(input.user, input.operationId);
    if (!existing) throw error;
    return existing;
  }
};

export const getFeedPostsForUser = async (userId: string, pagination: Pagination, mode: unknown = "discover"): Promise<{ items: Post[]; nextCursor: string | null }> => {
  const feedMode = mode === "following" ? "following" : "discover";
  const cacheKey = `feed:${userId}:${feedMode}:${pagination.cursor?.date.toISOString() ?? "first"}:${pagination.cursor?.id ?? ""}:${pagination.limit}`;
  const cached = await getCachedJson<{ items: Post[]; nextCursor: string | null }>(cacheKey);
  if (cached) return cached;
  let query = database.selectFrom("posts").innerJoin("users as author", "author.id", "posts.user_id").selectAll("posts");
  if (feedMode === "following") {
    query = query.where((expression) => expression.or([
      expression("posts.user_id", "=", userId),
      expression.and([
        expression("posts.visibility", "in", ["public", "followers"]),
        expression.or([
          sql<boolean>`exists (select 1 from user_follows uf where uf.follower_id = ${userId} and uf.followee_id = posts.user_id)`,
          sql<boolean>`exists (select 1 from connections c where c.status = 'accepted' and ((c.from_user_id = ${userId} and c.to_user_id = posts.user_id) or (c.to_user_id = ${userId} and c.from_user_id = posts.user_id)))`,
        ]),
        expression.or([expression("posts.post_type", "!=", "workout"), expression("author.privacy_show_workouts_on_feed", "=", true)]),
      ]),
    ]));
  } else {
    query = query.where((expression) => expression.or([
      expression("posts.user_id", "=", userId),
      expression.and([expression("posts.visibility", "=", "public"), expression("posts.post_type", "!=", "workout")]),
    ]));
  }
  if (pagination.cursor) query = query.where((expression) => expression.or([
    expression("posts.created_at", "<", pagination.cursor!.date),
    expression.and([expression("posts.created_at", "=", pagination.cursor!.date), expression("posts.id", "<", pagination.cursor!.id)]),
  ]));
  const rows = await query.orderBy("posts.created_at", "desc").orderBy("posts.id", "desc").limit(pagination.limit + 1).execute();
  const hasMore = rows.length > pagination.limit; const selected = hasMore ? rows.slice(0, pagination.limit) : rows;
  const hydrated = await hydratePostInteractions(await hydratePosts(selected), userId);
  const last = selected.at(-1);
  const result = { items: hydrated, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ date: new Date(last.created_at).toISOString(), id: last.id })).toString("base64url") : null };
  await setCachedJson(cacheKey, result, 30);
  return result;
};

export const getPostById = (postId: string): Promise<PostAccessRecord | null> => findPostAccessRecord(postId, true);
export const getPostForLike = (postId: string): Promise<PostAccessRecord | null> => findPostAccessRecord(postId);
export const getPostForComment = getPostForLike;
export const toggleLikePost = togglePostLike;
export const idempotentLikePost = likePost;
export const idempotentUnlikePost = unlikePost;
export const addCommentToPost = createPostComment;
export const getCommentsForPost = getPostComments;

export const deletePostById = async (post: PostAccessRecord): Promise<void> => {
  await withTransaction(async (transaction) => {
    await queueMediaDeletions(post.image_keys, { transaction });
    await deleteInteractionsForPost(post.id, { transaction });
    await transaction.deleteFrom("posts").where("id", "=", post.id).where("user_id", "=", post.user).execute();
  });
  await invalidateCachePrefix("feed:");
};
