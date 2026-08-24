import type { Post, PostType, PostVisibility } from "@motionmeet/shared";
import { sql } from "kysely";
import { database, withTransaction } from "../configs/database.js";
import { getCachedField, setCachedField } from "../configs/redis.js";
import { singleFlight } from "../utils/singleFlight.js";
import { FEED_CACHE_TTL_SECONDS, feedCacheOwner, invalidateOwnFeed } from "./feedCache.js";
import { findHydratedPost, findPostAccessRecord, hydratePosts, type PostAccessRecord } from "../repositories/postRepository.js";
import { canAccessPost as evaluatePostAccess } from "./accessControlService.js";
import type { Pagination } from "../utils/pagination.js";
import { UUID_PATTERN } from "../utils/validation.js";
import { commitReservedUploads } from "./mediaUploadService.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";
import { createPostComment, deleteInteractionsForPost, getPostComments, hydratePostInteractions, likePost, togglePostLike, unlikePost } from "./postInteractionService.js";
import * as quotaService from "./quotaService.js";

/**
 * Authority for every read of a single post. `accessControlService` applies both
 * the account gate (a private account hides even its public posts from
 * non-followers) and the per-post visibility gate.
 */
export const canAccessPost = (post: PostAccessRecord, requester: { _id: string }): Promise<boolean> =>
  evaluatePostAccess({ user: post.user, visibility: post.visibility }, requester._id);

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
    await invalidateOwnFeed(input.user);
    return post;
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await findPostByOperation(input.user, input.operationId);
    if (!existing) throw error;
    return existing;
  }
};

/**
 * `following` is the home feed: the member's own posts at every visibility, plus
 * posts from accounts they follow (or are connected to) that are `public` or
 * `followers`. Somebody else's `private` post is never in this set.
 *
 * `discover` is Keşfet: `public` posts only - not the member's own `private` or
 * `followers` posts either - and nothing from a private account the member does
 * not follow.
 */
export const getFeedPostsForUser = async (userId: string, pagination: Pagination, mode: unknown = "discover"): Promise<{ items: Post[]; nextCursor: string | null }> => {
  const feedMode = mode === "following" ? "following" : "discover";
  const owner = feedCacheOwner(userId);
  // Keyed on the raw cursor rather than its decoded parts: Keşfet paginates on
  // `(discover_rank, id)`, which does not decode into `pagination.cursor` at
  // all, so keying on the decoded date collapsed every discover page onto the
  // same entry and served page one forever.
  const field = `${feedMode}:${pagination.rawCursor ?? "first"}:${pagination.limit}`;
  const cached = await getCachedField<{ items: Post[]; nextCursor: string | null }>(owner, field);
  if (cached) return cached;

  // A miss under load must cost one query, not one per waiting request: the
  // entry expiring while a thousand members are scrolling would otherwise send
  // a thousand identical feed queries at PostgreSQL together.
  return singleFlight(`${owner}:${field}`, async () => {
    const fresh = await getCachedField<{ items: Post[]; nextCursor: string | null }>(owner, field);
    if (fresh) return fresh;

    const rows = feedMode === "following"
      ? await queryFollowingFeed(userId, pagination)
      : await queryDiscoverFeed(userId, pagination);

    const hasMore = rows.length > pagination.limit;
    const selected = hasMore ? rows.slice(0, pagination.limit) : rows;
    const hydrated = await hydratePostInteractions(await hydratePosts(selected), userId);
    const last = selected.at(-1);
    const nextCursor = hasMore && last
      ? feedMode === "following"
        ? encodeCursor({ date: new Date(last.created_at).toISOString(), id: last.id })
        : encodeCursor({ rank: Number(last.discover_rank), id: last.id })
      : null;
    const result = { items: hydrated, nextCursor };
    await setCachedField(owner, field, result, FEED_CACHE_TTL_SECONDS);
    return result;
  });
};

const encodeCursor = (value: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const queryFollowingFeed = async (userId: string, pagination: Pagination) => {
  let query = database.selectFrom("posts").innerJoin("users as author", "author.id", "posts.user_id").selectAll("posts")
    .where((expression) => expression.or([
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
  if (pagination.cursor) {
    query = query.where((expression) => expression.or([
      expression("posts.created_at", "<", pagination.cursor!.date),
      expression.and([expression("posts.created_at", "=", pagination.cursor!.date), expression("posts.id", "<", pagination.cursor!.id)]),
    ]));
  }
  return query.orderBy("posts.created_at", "desc").orderBy("posts.id", "desc").limit(pagination.limit + 1).execute();
};

/**
 * Keşfet ranks by `posts.discover_rank`, a stored column that adds a
 * logarithmic engagement bonus to the post's age in days - so a well-liked post
 * outranks quieter newer ones without the feed freezing on all-time favourites.
 * Pagination is a keyset walk over `(discover_rank, id)`, which the partial
 * index on public posts serves directly.
 */
const queryDiscoverFeed = async (userId: string, pagination: Pagination) => {
  const rankCursor = parseRankCursor(pagination.rawCursor);
  let query = database.selectFrom("posts").innerJoin("users as author", "author.id", "posts.user_id").selectAll("posts")
    .where("posts.visibility", "=", "public")
    // A private account is absent from Keşfet unless the viewer already follows
    // it; its own posts stay reachable from the home feed and its profile.
    .where((expression) => expression.or([
      expression("author.privacy_public_profile", "=", true),
      expression("posts.user_id", "=", userId),
      sql<boolean>`exists (select 1 from user_follows uf where uf.follower_id = ${userId} and uf.followee_id = posts.user_id)`,
    ]))
    .where((expression) => expression.or([
      expression("posts.post_type", "!=", "workout"),
      expression("author.privacy_show_workouts_on_feed", "=", true),
    ]));
  if (rankCursor) {
    query = query.where((expression) => expression.or([
      expression("posts.discover_rank", "<", rankCursor.rank),
      expression.and([expression("posts.discover_rank", "=", rankCursor.rank), expression("posts.id", "<", rankCursor.id)]),
    ]));
  }
  return query.orderBy("posts.discover_rank", "desc").orderBy("posts.id", "desc").limit(pagination.limit + 1).execute();
};

const parseRankCursor = (raw: string | null): { rank: number; id: string } | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as { rank?: unknown; id?: unknown };
    const rank = Number(value.rank);
    return Number.isFinite(rank) && typeof value.id === "string" && UUID_PATTERN.test(value.id) ? { rank, id: value.id } : null;
  } catch {
    return null;
  }
};

export const getPostById = (postId: string): Promise<PostAccessRecord | null> => findPostAccessRecord(postId, true);

/**
 * One post, in the same shape the feed serves, for a viewer allowed to see it.
 *
 * Everything that links to a single post goes through here: the activity row
 * that says someone liked your photo, a share link opened on the web, a deep
 * link back into the app. The access check is the same one the feed and the
 * comment endpoints use, so knowing a post's id is never enough on its own —
 * a followers-only or private post stays unreadable to anyone the author has
 * not let in, however they arrived at the URL.
 */
export const getVisiblePostForViewer = async (postId: string, viewerId: string): Promise<Post | null> => {
  const access = await findPostAccessRecord(postId);
  if (!access) return null;
  if (!(await evaluatePostAccess({ user: access.user, visibility: access.visibility }, viewerId))) {
    return null;
  }
  const post = await findHydratedPost(postId);
  if (!post) return null;
  const [hydrated] = await hydratePostInteractions([post], viewerId);
  return hydrated ?? post;
};
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
  await invalidateOwnFeed(post.user);
};
