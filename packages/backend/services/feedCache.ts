import { bumpCacheEpoch, getCacheEpoch, invalidateCacheOwners } from "../configs/redis.js";

/**
 * One place that decides what a feed cache entry is called and whose entry a
 * write drops. Every service that touches the feed goes through here, so the
 * invalidation policy is stated once instead of being re-decided at nine call
 * sites.
 *
 * ## Policy
 *
 * A write drops the cache of the member who made it, and nobody else's.
 *
 * That is a deliberate narrowing. The previous behaviour dropped *every*
 * member's feed on every like, comment, post, follow and profile update, which
 * meant a busy post could keep the entire population in a permanent cache miss.
 * Only the actor needs to see their own write immediately - their own post at
 * the top of the feed, their own like reflected in `liked_by_me`, their own
 * follow reflected in `author_followed_by_me`. For everyone else the change is
 * a count moving by one, and the 30-second TTL already carries it.
 *
 * The author snapshot embedded in other members' cached feeds is refreshed by
 * the `user.profile.updated` outbox event on top of that TTL.
 *
 * ## Writes that take access away
 *
 * The narrowing above is only safe for writes that *add* or *count* things.
 * A write that removes somebody's right to see a post cannot wait out the TTL,
 * because the stale entry is then a privacy leak, not a slow counter:
 *
 * - between two members (unfollow, removed connection, declined request) both
 *   members' entries are dropped, which is still O(1);
 * - an account going private, hiding its workouts, or a post being deleted
 *   affects viewers nobody can enumerate - any Keşfet page may hold it - so
 *   those bump the audience epoch instead. The epoch is part of every feed
 *   field name, so one `INCR` retires every cached page at once. These writes
 *   are rare next to reads, which is what makes a global miss acceptable.
 *
 * ## What "dropped" means
 *
 * Dropping an owner bumps its generation in Redis (configs/redis.ts). A page
 * that a concurrent request read from PostgreSQL before the write committed,
 * and stores only after this invalidation, lands under the old generation and
 * is never served - so the drop holds even against that race, which a plain
 * `DEL` did not. When Redis is reachable and the invalidation succeeds, a read
 * that starts after the write has answered sees fresh data; if it fails after
 * its retries, the entry lives at most its TTL (D-10 in the 2026-11 audit).
 */
export const FEED_CACHE_TTL_SECONDS = 30;
export const PROFILE_CACHE_TTL_SECONDS = 60;

export const feedCacheOwner = (userId: string): string => `feed:${userId}`;
export const profileCacheOwner = (profileId: string): string => `profile:${profileId}`;

/** Drops the acting member's own feed page cache. O(1) per member. */
export const invalidateOwnFeed = (...userIds: string[]): Promise<void> =>
  invalidateCacheOwners(...userIds.map(feedCacheOwner));

/** Drops a profile's cached header + first pages, for every viewer at once. */
export const invalidateProfile = (...profileIds: string[]): Promise<void> =>
  invalidateCacheOwners(...profileIds.map(profileCacheOwner));

/** A member changed something visible on both surfaces at once. */
export const invalidateMember = (...userIds: string[]): Promise<void> =>
  invalidateCacheOwners(...userIds.flatMap((id) => [feedCacheOwner(id), profileCacheOwner(id)]));

const FEED_AUDIENCE_EPOCH = "feed-audience";

/** The current audience epoch; part of every feed cache field name. */
export const feedAudienceEpoch = (): Promise<number> => getCacheEpoch(FEED_AUDIENCE_EPOCH);

/**
 * Retires every cached feed page at once, for a write that narrows who may see
 * content to an audience that cannot be listed. See "Writes that take access
 * away" above.
 */
export const revokeFeedAudience = (): Promise<void> => bumpCacheEpoch(FEED_AUDIENCE_EPOCH);
