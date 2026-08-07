import type { RelationshipState } from "@motionmeet/shared";
import { database, withTransaction } from "../configs/database.js";
import { invalidateCachePrefix } from "../configs/redis.js";
import { emitToUser } from "../realtime/socketRegistry.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";
import * as notificationService from "./notificationService.js";

const MAX_RELATIONSHIPS = 10_000;
const DAILY_FOLLOW_REQUEST_LIMIT = 100;

export type FollowAction = "followed" | "requested" | "already_requested" | "already_following";

/**
 * Reads both directions of the graph in one round trip.
 *
 * Following is deliberately one-way: A following B says nothing about B
 * following A, which is what lets the UI offer "Follow back" as a distinct
 * state from "Follow".
 */
export const getRelationshipState = async (viewerId: string, targetId: string): Promise<RelationshipState> => {
  if (viewerId === targetId) {
    return { isFollowing: false, isFollowedBy: false, requestSent: false, requestReceived: false, isConnection: false, connectionPending: false };
  }
  const [follows, requests, connection] = await Promise.all([
    database
      .selectFrom("user_follows")
      .select(["follower_id", "followee_id"])
      .where((expression) =>
        expression.or([
          expression.and([expression("follower_id", "=", viewerId), expression("followee_id", "=", targetId)]),
          expression.and([expression("follower_id", "=", targetId), expression("followee_id", "=", viewerId)]),
        ]),
      )
      .execute(),
    database
      .selectFrom("follow_requests")
      .select(["requester_id", "target_id"])
      .where((expression) =>
        expression.or([
          expression.and([expression("requester_id", "=", viewerId), expression("target_id", "=", targetId)]),
          expression.and([expression("requester_id", "=", targetId), expression("target_id", "=", viewerId)]),
        ]),
      )
      .execute(),
    database
      .selectFrom("connections")
      .select("status")
      .where("pair_key", "=", [viewerId, targetId].sort().join(":"))
      .executeTakeFirst(),
  ]);
  return {
    isFollowing: follows.some((row) => row.follower_id === viewerId),
    isFollowedBy: follows.some((row) => row.follower_id === targetId),
    requestSent: requests.some((row) => row.requester_id === viewerId),
    requestReceived: requests.some((row) => row.requester_id === targetId),
    isConnection: connection?.status === "accepted",
    connectionPending: connection?.status === "pending",
  };
};

/** Bulk variant for lists: which of `targetIds` the viewer follows / has asked to follow. */
export const getRelationshipMap = async (
  viewerId: string,
  targetIds: string[],
): Promise<Map<string, Pick<RelationshipState, "isFollowing" | "isFollowedBy" | "requestSent" | "requestReceived">>> => {
  const unique = [...new Set(targetIds)].filter((id) => id !== viewerId);
  const result = new Map<string, Pick<RelationshipState, "isFollowing" | "isFollowedBy" | "requestSent" | "requestReceived">>();
  if (!unique.length) return result;
  const [follows, requests] = await Promise.all([
    database
      .selectFrom("user_follows")
      .select(["follower_id", "followee_id"])
      .where((expression) =>
        expression.or([
          expression.and([expression("follower_id", "=", viewerId), expression("followee_id", "in", unique)]),
          expression.and([expression("followee_id", "=", viewerId), expression("follower_id", "in", unique)]),
        ]),
      )
      .execute(),
    database
      .selectFrom("follow_requests")
      .select(["requester_id", "target_id"])
      .where((expression) =>
        expression.or([
          expression.and([expression("requester_id", "=", viewerId), expression("target_id", "in", unique)]),
          expression.and([expression("target_id", "=", viewerId), expression("requester_id", "in", unique)]),
        ]),
      )
      .execute(),
  ]);
  for (const id of unique) result.set(id, { isFollowing: false, isFollowedBy: false, requestSent: false, requestReceived: false });
  for (const row of follows) {
    if (row.follower_id === viewerId) { const entry = result.get(row.followee_id); if (entry) entry.isFollowing = true; }
    else { const entry = result.get(row.follower_id); if (entry) entry.isFollowedBy = true; }
  }
  for (const row of requests) {
    if (row.requester_id === viewerId) { const entry = result.get(row.target_id); if (entry) entry.requestSent = true; }
    else { const entry = result.get(row.requester_id); if (entry) entry.requestReceived = true; }
  }
  return result;
};

const notifyRelationshipChange = async (leftId: string, rightId: string): Promise<void> => {
  try {
    const [forLeft, forRight] = await Promise.all([
      getRelationshipState(leftId, rightId),
      getRelationshipState(rightId, leftId),
    ]);
    emitToUser(leftId, "relationship_changed", { userId: rightId, isFollowing: forLeft.isFollowing, isFollowedBy: forLeft.isFollowedBy, requestSent: forLeft.requestSent, requestReceived: forLeft.requestReceived });
    emitToUser(rightId, "relationship_changed", { userId: leftId, isFollowing: forRight.isFollowing, isFollowedBy: forRight.isFollowedBy, requestSent: forRight.requestSent, requestReceived: forRight.requestReceived });
  } catch (error: unknown) {
    logger.warn("relationship_broadcast_failed", safeErrorMetadata(error));
  }
};

const invalidateFor = async (leftId: string, rightId: string): Promise<void> => {
  await Promise.all([
    invalidateCachePrefix(`profile:${leftId}:`),
    invalidateCachePrefix(`profile:${rightId}:`),
    invalidateCachePrefix("feed:"),
  ]);
};

/**
 * Follows someone, the way Instagram does it: an open account is followed on
 * the spot, a private one only receives a request that its owner has to
 * approve. Which of the two happens is decided here from the target's own
 * privacy setting - never from anything the caller sends.
 */
export const requestFollow = async (requesterId: string, targetId: string): Promise<FollowAction> => {
  const action = await withTransaction<FollowAction>(async (transaction) => {
    const target = await transaction
      .selectFrom("users")
      .select("privacy_public_profile")
      .where("id", "=", targetId)
      .executeTakeFirst();
    if (!target) throw Object.assign(new Error("User not found"), { status: 404 });
    const targetIsOpen = target.privacy_public_profile;

    const existingFollow = await transaction
      .selectFrom("user_follows")
      .select("follower_id")
      .where("follower_id", "=", requesterId)
      .where("followee_id", "=", targetId)
      .executeTakeFirst();
    if (existingFollow) return "already_following";

    const existingRequest = await transaction
      .selectFrom("follow_requests")
      .select("id")
      .where("requester_id", "=", requesterId)
      .where("target_id", "=", targetId)
      .executeTakeFirst();
    // A request left over from when the account was private is honoured the
    // moment it opens up, rather than sitting there needing an approval the
    // account no longer asks for.
    if (existingRequest && !targetIsOpen) return "already_requested";

    // Cheap per-day ceiling so a compromised token cannot spray follows at the
    // whole user table. Shares the usage_counters mechanism the rest of the API
    // uses for quotas.
    const now = new Date();
    const bucket = `follow_requests:${now.toISOString().slice(0, 10)}`;
    await transaction
      .insertInto("usage_counters")
      .values({ legacy_mongo_id: null, user_id: requesterId, bucket, count: 0, expires_at: new Date(now.getTime() + 172_800_000) })
      .onConflict((conflict) => conflict.columns(["user_id", "bucket"]).doNothing())
      .execute();
    const quota = await transaction
      .updateTable("usage_counters")
      .set((expression) => ({ count: expression("count", "+", 1) }))
      .where("user_id", "=", requesterId)
      .where("bucket", "=", bucket)
      .where("count", "<", DAILY_FOLLOW_REQUEST_LIMIT)
      .executeTakeFirst();
    if (Number(quota.numUpdatedRows) !== 1) {
      throw Object.assign(new Error("Daily follow request limit reached"), { status: 429 });
    }

    if (!targetIsOpen) {
      await transaction
        .insertInto("follow_requests")
        .values({ requester_id: requesterId, target_id: targetId })
        .onConflict((conflict) => conflict.columns(["requester_id", "target_id"]).doNothing())
        .execute();
      return "requested";
    }

    if (existingRequest) {
      await transaction.deleteFrom("follow_requests").where("id", "=", existingRequest.id).execute();
    }
    await writeFollowEdge(transaction, requesterId, targetId);
    return "followed";
  });

  if (action === "requested") {
    await notificationService.publishNotification(
      await notificationService.recordNotification({ userId: targetId, actorId: requesterId, type: "follow_request" }),
    );
    await notifyRelationshipChange(requesterId, targetId);
  }
  if (action === "followed") {
    // The stale request row may have carried a notification with Confirm/Delete
    // on it; the follow already happened, so it must not still be offered.
    await notificationService.clearFollowRequestNotification(targetId, requesterId);
    await notificationService.publishNotification(
      await notificationService.recordNotification({ userId: targetId, actorId: requesterId, type: "follow" }),
    );
    await invalidateFor(requesterId, targetId);
    await notifyRelationshipChange(requesterId, targetId);
  }
  return action;
};

/**
 * Writes the follow edge and both counters together, so a crash can never leave
 * a follower without a matching count. Shared by the instant-follow path and by
 * approving a request.
 */
const writeFollowEdge = async (
  transaction: Parameters<Parameters<typeof withTransaction>[0]>[0],
  followerId: string,
  followeeId: string,
): Promise<void> => {
  const inserted = await transaction
    .insertInto("user_follows")
    .values({ follower_id: followerId, followee_id: followeeId })
    .onConflict((conflict) => conflict.columns(["follower_id", "followee_id"]).doNothing())
    .returning("follower_id")
    .executeTakeFirst();
  if (!inserted) return;

  const follower = await transaction
    .updateTable("users")
    .set((expression) => ({ following_count: expression("following_count", "+", 1) }))
    .where("id", "=", followerId)
    .where("following_count", "<", MAX_RELATIONSHIPS)
    .executeTakeFirst();
  const followee = await transaction
    .updateTable("users")
    .set((expression) => ({ followers_count: expression("followers_count", "+", 1) }))
    .where("id", "=", followeeId)
    .where("followers_count", "<", MAX_RELATIONSHIPS)
    .executeTakeFirst();
  if (Number(follower.numUpdatedRows) !== 1 || Number(followee.numUpdatedRows) !== 1) {
    throw Object.assign(new Error("Relationship limit reached"), { status: 409 });
  }
};

/** Withdraws a request the viewer sent. */
export const cancelFollowRequest = async (requesterId: string, targetId: string): Promise<boolean> => {
  const deleted = await database
    .deleteFrom("follow_requests")
    .where("requester_id", "=", requesterId)
    .where("target_id", "=", targetId)
    .returning("id")
    .executeTakeFirst();
  if (!deleted) return false;
  await notificationService.clearFollowRequestNotification(targetId, requesterId);
  await notifyRelationshipChange(requesterId, targetId);
  return true;
};

/** Approves a pending request: the request row becomes a real follow edge. */
export const acceptFollowRequest = async (userId: string, requesterId: string): Promise<boolean> => {
  const accepted = await withTransaction(async (transaction) => {
    const request = await transaction
      .selectFrom("follow_requests")
      .select("id")
      .where("requester_id", "=", requesterId)
      .where("target_id", "=", userId)
      .forUpdate()
      .executeTakeFirst();
    if (!request) return false;
    await transaction.deleteFrom("follow_requests").where("id", "=", request.id).execute();
    await writeFollowEdge(transaction, requesterId, userId);
    return true;
  });
  if (!accepted) return false;

  await notificationService.clearFollowRequestNotification(userId, requesterId);
  await notificationService.publishNotification(
    await notificationService.recordNotification({ userId: requesterId, actorId: userId, type: "follow_request_accepted" }),
  );
  await invalidateFor(userId, requesterId);
  await notifyRelationshipChange(userId, requesterId);
  return true;
};

export const declineFollowRequest = async (userId: string, requesterId: string): Promise<boolean> => {
  const deleted = await database
    .deleteFrom("follow_requests")
    .where("requester_id", "=", requesterId)
    .where("target_id", "=", userId)
    .returning("id")
    .executeTakeFirst();
  if (!deleted) return false;
  await notificationService.clearFollowRequestNotification(userId, requesterId);
  await notifyRelationshipChange(userId, requesterId);
  return true;
};

/** Stops following, and also withdraws a request that never got approved. */
export const unfollow = async (userId: string, targetId: string): Promise<void> => {
  await withTransaction(async (transaction) => {
    await transaction.deleteFrom("follow_requests").where("requester_id", "=", userId).where("target_id", "=", targetId).execute();
    const deleted = await transaction
      .deleteFrom("user_follows")
      .where("follower_id", "=", userId)
      .where("followee_id", "=", targetId)
      .returning("follower_id")
      .executeTakeFirst();
    if (!deleted) return;
    await transaction
      .updateTable("users")
      .set((expression) => ({ following_count: expression.fn<number>("greatest", [expression("following_count", "-", 1), expression.val(0)]) }))
      .where("id", "=", userId)
      .execute();
    await transaction
      .updateTable("users")
      .set((expression) => ({ followers_count: expression.fn<number>("greatest", [expression("followers_count", "-", 1), expression.val(0)]) }))
      .where("id", "=", targetId)
      .execute();
  });
  await notificationService.clearFollowRequestNotification(targetId, userId);
  await invalidateFor(userId, targetId);
  await notifyRelationshipChange(userId, targetId);
};

interface RequestPage { items: Array<{ user: { id: string; _id: string; full_name: string; username: string; profile_picture: string }; createdAt: string }>; nextCursor: string | null }

const listRequests = async (
  userId: string,
  direction: "incoming" | "outgoing",
  limit: number,
  cursor: { date: Date; id: string } | null,
): Promise<RequestPage> => {
  const ownColumn = direction === "incoming" ? "target_id" as const : "requester_id" as const;
  const otherColumn = direction === "incoming" ? "requester_id" as const : "target_id" as const;
  let query = database
    .selectFrom("follow_requests")
    .innerJoin("users", "users.id", `follow_requests.${otherColumn}`)
    .select([
      "follow_requests.id as id",
      "follow_requests.created_at as created_at",
      "users.id as user_id",
      "users.full_name as full_name",
      "users.username as username",
      "users.profile_picture_url as profile_picture_url",
    ])
    .where(`follow_requests.${ownColumn}`, "=", userId);
  if (cursor) {
    query = query.where((expression) =>
      expression.or([
        expression("follow_requests.created_at", "<", cursor.date),
        expression.and([
          expression("follow_requests.created_at", "=", cursor.date),
          expression("follow_requests.id", "<", cursor.id),
        ]),
      ]),
    );
  }
  const rows = await query
    .orderBy("follow_requests.created_at", "desc")
    .orderBy("follow_requests.id", "desc")
    .limit(limit + 1)
    .execute();
  const hasMore = rows.length > limit;
  const selected = hasMore ? rows.slice(0, limit) : rows;
  const last = selected.at(-1);
  return {
    items: selected.map((row) => ({
      user: { id: row.user_id, _id: row.user_id, full_name: row.full_name, username: row.username, profile_picture: row.profile_picture_url },
      createdAt: new Date(row.created_at).toISOString(),
    })),
    nextCursor:
      hasMore && last
        ? Buffer.from(JSON.stringify({ date: new Date(last.created_at).toISOString(), id: last.id })).toString("base64url")
        : null,
  };
};

export const getIncomingRequests = (userId: string, limit: number, cursor: { date: Date; id: string } | null): Promise<RequestPage> =>
  listRequests(userId, "incoming", limit, cursor);
export const getOutgoingRequests = (userId: string, limit: number, cursor: { date: Date; id: string } | null): Promise<RequestPage> =>
  listRequests(userId, "outgoing", limit, cursor);

export const countIncomingRequests = async (userId: string): Promise<number> =>
  Number(
    (
      await database
        .selectFrom("follow_requests")
        .select((expression) => expression.fn.countAll<number>().as("count"))
        .where("target_id", "=", userId)
        .executeTakeFirst()
    )?.count ?? 0,
  );
