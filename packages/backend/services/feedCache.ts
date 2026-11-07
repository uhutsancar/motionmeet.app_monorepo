import { getCacheEpoch, invalidateCacheOwners, recordRetractions, retractionTimes } from "../configs/redis.js";

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
 * ## Profiles
 *
 * A profile's cache owner is the profile, and every viewer's entry lives under
 * it, so one invalidation reaches all viewers. Creating or deleting a post and
 * logging a workout drop the author's profile along with their feed: the post
 * list and the training totals are what the author checks right after. Like
 * and comment counts on profile posts are *not* invalidated, exactly as on the
 * feed - they move by one and the 60-second TTL carries them.
 *
 * ## Writes that take access away
 *
 * The narrowing above is only safe for writes that *add* or *count* things.
 * A write that removes somebody's right to see a post cannot wait out the TTL,
 * because the stale entry is then a privacy leak, not a slow counter:
 *
 * - between two members (unfollow, removed connection, declined request) both
 *   members' entries are dropped, which is still O(1);
 * - a post deleted, an account deleted or gone private, or workouts hidden
 *   affect viewers nobody can enumerate - any Keşfet page may hold them - so
 *   they are recorded as *retractions* (`retractPost`, `retractAuthor`) and
 *   every feed page served is filtered against them (`withoutRetracted`).
 *
 *   These used to bump one global epoch that was part of every feed field
 *   name: each deletion anywhere sent every member's next feed read to
 *   PostgreSQL at once, and single-flight only merges identical misses of one
 *   member in one process. As deletions grow with the user base that became a
 *   periodic thundering herd. A retraction costs one `ZMSCORE` over the page's
 *   own ids per read and retires nothing. It lives for the feed TTL plus the
 *   longest a page can take to compute, so no page written before it outlives
 *   it. Every page carries the time its data was read (`asOf`): an author's
 *   retraction only hides that author's posts from pages read before it, and
 *   only posts written before it - a member who goes private and posts right
 *   away is still seen by their followers.
 *
 *   The epoch is still read into every field name, so an operator can retire
 *   all feed pages with one `INCR motionmeet:v2:epoch:feed-audience`, and a
 *   replica still running the previous release keeps honouring it.
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

const FEED_RETRACTIONS = "feed";
/**
 * The feed TTL plus the longest a page can take from its first read to its
 * write (the statement timeout's ceiling, with room), so a page that read a
 * post just before it was deleted has expired before the retraction does.
 */
export const FEED_RETRACTION_TTL_SECONDS = FEED_CACHE_TTL_SECONDS + 150;

/** Deleted posts: gone from every cached feed page at once. */
export const retractPosts = (...postIds: string[]): Promise<void> =>
  recordRetractions(FEED_RETRACTIONS, postIds.map((id) => `post:${id}`), FEED_RETRACTION_TTL_SECONDS);

/**
 * An author whose posts some viewers may no longer see: everything they posted
 * (account deleted, or gone private), or only their workouts (hidden from feeds).
 */
export const retractAuthor = (authorId: string, scope: "all" | "workouts"): Promise<void> =>
  recordRetractions(FEED_RETRACTIONS, [`${scope === "all" ? "author" : "workouts"}:${authorId}`], FEED_RETRACTION_TTL_SECONDS);

interface FeedItem { id: string; post_type: string; createdAt: string; user: { id: string } | string }
const authorOf = (item: FeedItem): string => (typeof item.user === "string" ? item.user : item.user.id);

/**
 * Replica clocks differ a little. A page read this long before a retraction
 * was recorded is still treated as read before it.
 */
const CLOCK_SKEW_MS = 5_000;

/**
 * `items` of a page whose data was read at `asOf`, without anything
 * retracted since: deleted posts always, an author's posts when the page was
 * read before the author's retraction and the post was written before it.
 * Null when Redis could not answer: the caller must then not serve the page.
 */
export const withoutRetracted = async <T extends FeedItem>(items: T[], asOf: number): Promise<T[] | null> => {
  if (!items.length) return items;
  const members = new Set<string>();
  for (const item of items) {
    members.add(`post:${item.id}`);
    members.add(`author:${authorOf(item)}`);
    if (item.post_type === "workout") members.add(`workouts:${authorOf(item)}`);
  }
  const times = await retractionTimes(FEED_RETRACTIONS, [...members], FEED_RETRACTION_TTL_SECONDS);
  if (!times) return null;
  if (!times.size) return items;
  const hiddenBy = (member: string, item: T): boolean => {
    const retractedAt = times.get(member);
    return retractedAt !== undefined && retractedAt + CLOCK_SKEW_MS >= asOf && Date.parse(item.createdAt) < retractedAt;
  };
  return items.filter((item) => !times.has(`post:${item.id}`) && !hiddenBy(`author:${authorOf(item)}`, item)
    && !(item.post_type === "workout" && hiddenBy(`workouts:${authorOf(item)}`, item)));
};
