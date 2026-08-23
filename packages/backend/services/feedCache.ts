import { invalidateCacheOwners } from "../configs/redis.js";

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
