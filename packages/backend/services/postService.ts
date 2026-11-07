import type { Post, PostType, PostVisibility } from "@motionmeet/shared";
import { sql } from "kysely";
import { database, withTransaction } from "../configs/database.js";
import { cachedOwnerField } from "../configs/redis.js";
import { FEED_CACHE_TTL_SECONDS, feedAudienceEpoch, feedCacheOwner, invalidateMember, retractPosts, withoutRetracted } from "./feedCache.js";
import { findHydratedPost, findPostAccessRecord, hydratePosts, type PostAccessRecord } from "../repositories/postRepository.js";
import { canAccessPost as evaluatePostAccess } from "./accessControlService.js";
import type { Row } from "../db/types.js";
import type { Pagination } from "../utils/pagination.js";
import { UUID_PATTERN } from "../utils/validation.js";
import { mediaKindOf, type PostMediaInput } from "../utils/postMedia.js";
import { commitReservedUploads } from "./mediaUploadService.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";
import { enqueueOutboxEvent } from "./outboxService.js";
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

interface NewPostInput { user: string; operationId: string; content: string; media: PostMediaInput[]; post_type: PostType; visibility: PostVisibility; workout?: string }
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
      // Each row describes its own file. Dimensions and duration stay null until
      // something actually decodes the file; a guessed value would be worse
      // than none for a client sizing its layout from it.
      if (input.media.length) await transaction.insertInto("post_media").values(input.media.map((media, position) => ({
        legacy_mongo_id: null, post_id: row.id, position, url: media.url, object_key: media.key,
        media_type: mediaKindOf(media.contentType), mime_type: media.contentType,
        file_size: media.sizeBytes, width: null, height: null, duration_seconds: null,
      }))).execute();
      await commitReservedUploads(reservationKeys, { transaction, userId: input.user });
      // Measuring the files is the media worker's job, after the commit; the
      // event is written with the post so it cannot be lost or run early.
      if (input.media.length) {
        await enqueueOutboxEvent(transaction, { type: "media.uploaded", aggregateId: row.id, payload: { postId: row.id } });
      }
      const hydrated = await findHydratedPost(row.id, transaction);
      if (!hydrated) throw new Error("Created post could not be loaded");
      return hydrated;
    });
    // The author's own feed and their profile (first page and post count are
    // cached for every viewer) both have to show the new post at once.
    await invalidateMember(input.user);
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
  //
  // The audience epoch leads the field: an operator's switch to retire every
  // feed page at once (services/feedCache.ts).
  const field = `${await feedAudienceEpoch()}:${feedMode}:${pagination.rawCursor ?? "first"}:${pagination.limit}`;

  // A miss under load must cost one query, not one per waiting request: the
  // entry expiring while a thousand members are scrolling would otherwise send
  // a thousand identical feed queries at PostgreSQL together. The read-through
  // helper single-flights the miss and stores the page under the owner
  // generation read before the query, so a page computed across an
  // invalidation is never served.
  const compute = async (): Promise<{ items: Post[]; nextCursor: string | null; asOf: number }> => {
    // When the data was read, for the retraction filter below.
    const asOf = Date.now();
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
    return { items: hydrated, nextCursor, asOf };
  };
  // A page cached before a post was deleted (or its author went private) is
  // served without it; the cursor still points past the page, so paging is
  // unaffected. A page cached by the release before this one has no `asOf`
  // and is filtered as if read at the epoch. If Redis cannot say what was
  // retracted, the page is read again.
  const page = await cachedOwnerField(owner, field, FEED_CACHE_TTL_SECONDS, compute);
  const items = await withoutRetracted(page.items, page.asOf ?? 0);
  if (items) return { items, nextCursor: page.nextCursor };
  const fresh = await compute();
  return { items: fresh.items, nextCursor: fresh.nextCursor };
};

const encodeCursor = (value: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * The home feed, read audience-first.
 *
 * It used to scan every public and followers-only post in the table, newest
 * first, testing each against the follow and connection graph. Fine with a
 * few thousand posts; 3.7-4.4 s for a first page at 300 000 posts
 * (scripts/load/explain-feeds.sql on the synthetic data set). Now the
 * viewer's audience is listed first - themselves, the accounts they follow,
 * their accepted connections: dozens of rows - and only each member's newest
 * page is read, straight off `posts_author_timeline_idx`. The cost follows
 * the size of the audience, not of the table.
 *
 * It reads in two steps. The per-author walk returns only ids and times from
 * the covering index - index-only, stopping at the page size - and only the
 * one page that survives the merge is fetched from the table. Selecting whole
 * rows per author made PostgreSQL read every post of a popular author from
 * the heap first; with many members missing the cache at once, all following
 * the same big accounts, that queued requests for seconds on cold reads
 * (20 VUs over 300 members: p95 3.6 s with timeouts).
 *
 * The rules are unchanged: all of the viewer's own posts; other members'
 * `public` and `followers` posts; other members' workouts only where the
 * author shows workouts on the feed. The workout rule sits inside each
 * author's page, before its LIMIT, so a run of hidden workouts can never
 * crowd out posts that should appear.
 */
const queryFollowingFeed = async (userId: string, pagination: Pagination): Promise<Row<"posts">[]> => {
  const pageSize = pagination.limit + 1;
  const after = pagination.cursor
    ? sql`and (p.created_at, p.id) < (${pagination.cursor.date}::timestamptz, ${pagination.cursor.id}::uuid)`
    : sql``;
  const { rows } = await sql<Row<"posts">>`
    with audience as (
      select ${userId}::uuid as user_id, true as is_self, true as shows_workouts
      union all
      select u.id, false, u.privacy_show_workouts_on_feed
      from users u
      where u.id <> ${userId}::uuid and u.id in (
        select uf.followee_id from user_follows uf where uf.follower_id = ${userId}::uuid
        union
        select case when c.from_user_id = ${userId}::uuid then c.to_user_id else c.from_user_id end
        from connections c
        where c.status = 'accepted' and (c.from_user_id = ${userId}::uuid or c.to_user_id = ${userId}::uuid)
      )
    ),
    picked as (
      select page.id, page.created_at from audience a
      cross join lateral (
        select p.id, p.created_at from posts p
        where p.user_id = a.user_id
          and (a.is_self or p.visibility in ('public', 'followers'))
          and (a.is_self or p.post_type <> 'workout' or a.shows_workouts)
          ${after}
        order by p.created_at desc, p.id desc
        limit ${pageSize}
      ) page
      order by page.created_at desc, page.id desc
      limit ${pageSize}
    )
    select posts.* from picked
    join posts on posts.id = picked.id
    order by picked.created_at desc, picked.id desc`.execute(database);
  return rows;
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
  // Any member's cached page may hold the deleted post; the author expects it
  // gone from all of them, not after the TTL. Feed pages filter it out through
  // its retraction, every viewer's cached view of the author's profile is
  // dropped through the profile owner.
  await Promise.all([invalidateMember(post.user), retractPosts(post.id)]);
};
