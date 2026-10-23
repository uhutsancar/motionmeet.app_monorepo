import { database } from "../configs/database.js";

/**
 * One place for "may this account see that account's things".
 *
 * Every rule here is enforced on the server. The mobile app hides what a viewer
 * may not see, but hiding is presentation: a hand-written request to any post,
 * story, profile or conversation endpoint goes through these checks too.
 */

export interface AccountVisibility {
  /** The owner keeps their account private. */
  isPrivate: boolean;
  /** Viewer is an approved follower. */
  isFollower: boolean;
  /** Legacy two-way connection. */
  isConnection: boolean;
  /** Owner follows the viewer back. */
  followsViewer: boolean;
  /** Viewer may see the owner's posts and stories. */
  canViewContent: boolean;
}

const OWNER_VISIBILITY: AccountVisibility = {
  isPrivate: false,
  isFollower: true,
  isConnection: true,
  followsViewer: true,
  canViewContent: true,
};

/**
 * A private account's posts and stories are visible only to approved followers
 * (and to existing connections, which predate follow requests here). A public
 * account's content is visible to anyone; per-post visibility still applies on
 * top of this and is checked separately by `canAccessPost`.
 */
export const getAccountVisibility = async (viewerId: string, ownerId: string): Promise<AccountVisibility> => {
  if (viewerId === ownerId) return OWNER_VISIBILITY;
  const [owner, follows, connection] = await Promise.all([
    database.selectFrom("users").select("privacy_public_profile").where("id", "=", ownerId).executeTakeFirst(),
    database
      .selectFrom("user_follows")
      .select(["follower_id"])
      .where((expression) =>
        expression.or([
          expression.and([expression("follower_id", "=", viewerId), expression("followee_id", "=", ownerId)]),
          expression.and([expression("follower_id", "=", ownerId), expression("followee_id", "=", viewerId)]),
        ]),
      )
      .execute(),
    database
      .selectFrom("connections")
      .select("id")
      .where("pair_key", "=", [viewerId, ownerId].sort().join(":"))
      .where("status", "=", "accepted")
      .executeTakeFirst(),
  ]);
  const isPrivate = owner ? !owner.privacy_public_profile : true;
  const isFollower = follows.some((row) => row.follower_id === viewerId);
  const followsViewer = follows.some((row) => row.follower_id === ownerId);
  const isConnection = Boolean(connection);
  return {
    isPrivate,
    isFollower,
    isConnection,
    followsViewer,
    canViewContent: !isPrivate || isFollower || isConnection,
  };
};

export interface PostVisibilityRecord {
  user: string;
  visibility: "public" | "followers" | "private";
}

/**
 * Two gates, both required:
 *
 * 1. the account gate — a private account shows nothing to a non-follower, even
 *    for a post whose own visibility is `public`;
 * 2. the post gate — `private` is the author alone, `followers` needs an
 *    approved follow or a connection, `public` is open.
 */
export const canAccessPost = async (post: PostVisibilityRecord, viewerId: string): Promise<boolean> => {
  if (post.user === viewerId) return true;
  if (post.visibility === "private") return false;
  const visibility = await getAccountVisibility(viewerId, post.user);
  if (!visibility.canViewContent) return false;
  if (post.visibility === "public") return true;
  return visibility.isFollower || visibility.isConnection;
};

/** Stories follow the account gate: a private account's stories are for approved followers. */
export const canViewStoriesOf = async (viewerId: string, ownerId: string): Promise<boolean> => {
  if (viewerId === ownerId) return true;
  const visibility = await getAccountVisibility(viewerId, ownerId);
  // Stories are already a followers-first surface, so a public account still
  // requires a follow or connection - matching what the story feed query returns.
  return visibility.canViewContent && (visibility.isFollower || visibility.isConnection);
};

export interface MessagePermission {
  allowed: boolean;
  reason: "ok" | "blocked_by_settings" | "needs_mutual_follow" | "invalid_recipient";
}

/**
 * Direct messages:
 *
 * - a public account can be messaged by anyone who is allowed to message at all;
 * - a private account requires a mutual follow, so both sides have opted in;
 * - an existing accepted connection and superadmin keep working as before.
 */
export const evaluateMessagePermission = async (
  sender: { id: string; role?: string },
  recipientId: string,
): Promise<MessagePermission> => {
  if (!sender.id || sender.id === recipientId) return { allowed: false, reason: "invalid_recipient" };
  const recipient = await database
    .selectFrom("users")
    .select(["id", "privacy_allow_messages", "privacy_public_profile"])
    .where("id", "=", recipientId)
    .executeTakeFirst();
  if (!recipient) return { allowed: false, reason: "invalid_recipient" };
  if (sender.role === "superadmin") return { allowed: true, reason: "ok" };
  if (!recipient.privacy_allow_messages) return { allowed: false, reason: "blocked_by_settings" };

  const visibility = await getAccountVisibility(sender.id, recipientId);
  if (visibility.isConnection) return { allowed: true, reason: "ok" };
  if (!visibility.isPrivate) return { allowed: true, reason: "ok" };
  // Private account: both directions of the follow edge must exist.
  return visibility.isFollower && visibility.followsViewer
    ? { allowed: true, reason: "ok" }
    : { allowed: false, reason: "needs_mutual_follow" };
};
