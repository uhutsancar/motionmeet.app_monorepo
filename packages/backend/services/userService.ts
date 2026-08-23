import { sql } from "kysely";
import type { PublicUser, UserProfile } from "@motionmeet/shared";
import { database, withTransaction } from "../configs/database.js";
import { getCachedField, setCachedField } from "../configs/redis.js";
import { PROFILE_CACHE_TTL_SECONDS, invalidateMember, profileCacheOwner } from "./feedCache.js";
import type { Row } from "../db/types.js";
import { serializeUser, toIsoString, type InternalUser } from "../repositories/entities.js";
import { evaluateMessagePermission } from "./accessControlService.js";
import { getRelationshipMap, getRelationshipState, unfollow } from "./relationshipService.js";
import { findUserById } from "../repositories/userRepository.js";
import { hydratePosts } from "../repositories/postRepository.js";
import { hydratePostInteractions } from "./postInteractionService.js";
import { commitReservedUploads } from "./mediaUploadService.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { escapeLikePattern, isUserId } from "../utils/validation.js";
import type { Pagination } from "../utils/pagination.js";

const MAX_RELATIONSHIPS = 10_000;
const brief = (row: { id: string; full_name: string; username: string; profile_picture_url: string }): PublicUser => ({ id: row.id, _id: row.id, full_name: row.full_name, username: row.username, profile_picture: row.profile_picture_url });
// Search and suggestion lists reach people the member has no relationship with,
// so anything short of a public profile location is withheld there.
const summary = (row: { id: string; full_name: string; username: string; profile_picture_url: string; bio: string; location: string; location_visibility: string; followers_count: number; following_count: number; connections_count: number }) => ({ ...brief(row), bio: row.bio, location: row.location_visibility === "public" ? row.location : "", followers_count: row.followers_count, following_count: row.following_count, connections_count: row.connections_count });

/**
 * Stamps each row in a people list with both directions of the follow graph in
 * one extra query, so the cards can render Follow / Requested / Following /
 * Follow back without a request per card.
 */
type SummaryRow = ReturnType<typeof summary>;
const withRelationships = async <T extends SummaryRow>(rows: T[], viewerId: string): Promise<Array<T & { isFollowing: boolean; isFollowedBy: boolean; requestSent: boolean; requestReceived: boolean }>> => {
  const states = await getRelationshipMap(viewerId, rows.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    ...(states.get(row.id) ?? { isFollowing: false, isFollowedBy: false, requestSent: false, requestReceived: false }),
  }));
};
export const getUserById = (userId: string): Promise<InternalUser | null> => findUserById(userId, { plan: true });

export const getUserByIdWithPassword = async (userId: string): Promise<InternalUser | null> => {
  const row = await database.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirst();
  return row ? serializeUser(row, null, true) : null;
};
export const checkUsernameTaken = async (username: string, excludeUserId: string): Promise<boolean> => Boolean(await database.selectFrom("users").select("id").where("username", "=", username).where("id", "!=", excludeUserId).executeTakeFirst());

interface UserUpdate { [key: string]: unknown }
export const updateUser = async (userId: string, input: UserUpdate, { reservationKeys = [] }: { reservationKeys?: string[] } = {}): Promise<InternalUser | null> => {
  await withTransaction(async (transaction) => {
    const current = await transaction.selectFrom("users").selectAll().where("id", "=", userId).forUpdate().executeTakeFirst();
    if (!current) throw Object.assign(new Error("User not found"), { status: 404 });
    if (input.email !== undefined && current.role === "superadmin") throw Object.assign(new Error("SuperAdmin email address cannot be changed"), { status: 403 });
    const replacedMediaKeys: string[] = [];
    if (input.profile_picture !== undefined) { const key = current.profile_picture_key || extractS3Key(current.profile_picture_url); if (key) replacedMediaKeys.push(key); }
    if (input.cover_photo !== undefined) { const key = current.cover_photo_key || extractS3Key(current.cover_photo_url); if (key) replacedMediaKeys.push(key); }
    const changes = {
      ...(typeof input.email === "string" ? { email: input.email.trim().toLowerCase() } : {}),
      ...(typeof input.full_name === "string" ? { full_name: input.full_name } : {}),
      ...(typeof input.username === "string" ? { username: input.username.toLowerCase() } : {}),
      ...(typeof input.bio === "string" ? { bio: input.bio } : {}),
      // `location` is owned by locationService: it is rendered from a validated
      // dataset record, so it is never taken from a profile-update payload.
      ...(typeof input.profile_picture === "string" ? { profile_picture_url: input.profile_picture } : {}),
      ...(typeof input.profile_picture_key === "string" ? { profile_picture_key: input.profile_picture_key } : {}),
      ...(typeof input.cover_photo === "string" ? { cover_photo_url: input.cover_photo } : {}),
      ...(typeof input.cover_photo_key === "string" ? { cover_photo_key: input.cover_photo_key } : {}),
      ...(typeof input.weight === "number" ? { weight: input.weight } : {}),
      ...(typeof input.height === "number" ? { height: input.height } : {}),
      ...(typeof input["privacy.publicProfile"] === "boolean" ? { privacy_public_profile: input["privacy.publicProfile"] } : {}),
      ...(typeof input["privacy.showWorkoutsOnFeed"] === "boolean" ? { privacy_show_workouts_on_feed: input["privacy.showWorkoutsOnFeed"] } : {}),
      ...(typeof input["privacy.allowFollowers"] === "boolean" ? { privacy_allow_followers: input["privacy.allowFollowers"] } : {}),
      ...(typeof input["privacy.showInSearch"] === "boolean" ? { privacy_show_in_search: input["privacy.showInSearch"] } : {}),
      ...(typeof input["privacy.allowMessages"] === "boolean" ? { privacy_allow_messages: input["privacy.allowMessages"] } : {}),
    };
    if (Object.keys(changes).length) await transaction.updateTable("users").set(changes).where("id", "=", userId).execute();
    await commitReservedUploads(reservationKeys, { transaction, userId });
    await queueMediaDeletions(replacedMediaKeys.filter((key) => !reservationKeys.includes(key)), { transaction });
    const profileChanged = input.full_name !== undefined || input.username !== undefined || input.profile_picture !== undefined;
    if (profileChanged) {
      const payload: Record<string, string | number | boolean | null> = {};
      if (typeof input.full_name === "string") payload.full_name = input.full_name;
      if (typeof input.username === "string") payload.username = input.username;
      if (typeof input.profile_picture === "string") payload.profile_picture = input.profile_picture;
      await transaction.insertInto("outbox_events").values({ legacy_mongo_id: null, type: "user.profile.updated", aggregate_id: userId, payload, status: "pending", attempts: 0, next_attempt_at: new Date(), claim_token: null, claim_until: null, last_error: "" }).execute();
    }
  });
  await invalidateMember(userId);
  return getUserById(userId);
};

/**
 * People search.
 *
 * Matched against `lower(username::text)` and `lower(full_name)` rather than
 * with `ILIKE` on the columns themselves, so the query lines up exactly with
 * the trigram indexes migration 009 builds over those two expressions. `ILIKE`
 * on the raw columns could use no index at all and scanned the whole table.
 *
 * The term is escaped before it becomes a pattern: a member searching for `%`
 * would otherwise match every account in the system.
 */
export const searchUsers = async (input: string, excludeUserId: string) => {
  const term = input.trim().toLowerCase(); if (!term) return [];
  const escaped = escapeLikePattern(term);
  const prefix = `${escaped}%`;
  const rows = await database.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url", "bio", "location", "location_visibility", "followers_count", "following_count", "connections_count"])
    .where("id", "!=", excludeUserId).where("privacy_show_in_search", "=", true)
    .where((expression) => expression.or([
      sql<boolean>`lower(users.username::text) like ${prefix}`,
      sql<boolean>`lower(users.full_name) like ${`%${escaped}%`}`,
    ]))
    .orderBy(sql`case when lower(users.username::text) like ${prefix} then 0 else 1 end`).orderBy("followers_count", "desc").limit(20).execute();
  return withRelationships(rows.map(summary), excludeUserId);
};

export const validateTargetUser = async (requesterId: string, targetId: unknown, privacyField?: "allowFollowers" | "allowMessages"): Promise<{ id: string } | null> => {
  if (!isUserId(targetId) || targetId === requesterId) return null;
  let query = database.selectFrom("users").select("id").where("id", "=", targetId);
  if (privacyField === "allowFollowers") query = query.where("privacy_allow_followers", "=", true);
  if (privacyField === "allowMessages") query = query.where("privacy_allow_messages", "=", true);
  return await query.executeTakeFirst() ?? null;
};

// Following is a request/accept handshake now; both directions live in
// relationshipService so there is one implementation of the counter bookkeeping.
export { requestFollow, acceptFollowRequest, declineFollowRequest, cancelFollowRequest, getRelationshipState } from "./relationshipService.js";
export const unfollowUser = (userId: string, targetId: string): Promise<void> => unfollow(userId, targetId);

export const getConnectionBetweenUsers = async (left: string, right: string) => {
  const row = await database.selectFrom("connections").selectAll().where("pair_key", "=", [left, right].sort().join(":")).executeTakeFirst();
  return row ? { id: row.id, _id: row.id, from_user_id: row.from_user_id, to_user_id: row.to_user_id, status: row.status, createdAt: toIsoString(row.created_at), updatedAt: toIsoString(row.updated_at) } : null;
};

export const getAcceptedConnectionUserIds = async (userId: string): Promise<string[]> => {
  const rows = await database.selectFrom("connections").select(["from_user_id", "to_user_id"]).where("status", "=", "accepted").where((expression) => expression.or([expression("from_user_id", "=", userId), expression("to_user_id", "=", userId)])).limit(MAX_RELATIONSHIPS).execute();
  return rows.map((row) => row.from_user_id === userId ? row.to_user_id : row.from_user_id);
};

export const createConnection = async (userId: string, targetId: string) => withTransaction(async (transaction) => {
  const now = new Date(); const bucket = `connection_requests:${now.toISOString().slice(0, 10)}`;
  await transaction.insertInto("usage_counters").values({ legacy_mongo_id: null, user_id: userId, bucket, count: 0, expires_at: new Date(now.getTime() + 172_800_000) }).onConflict((conflict) => conflict.columns(["user_id", "bucket"]).doNothing()).execute();
  const quota = await transaction.updateTable("usage_counters").set((expression) => ({ count: expression("count", "+", 1) })).where("user_id", "=", userId).where("bucket", "=", bucket).where("count", "<", 20).executeTakeFirst();
  if (Number(quota.numUpdatedRows) !== 1) throw Object.assign(new Error("Daily connection request limit reached"), { status: 429 });
  const row = await transaction.insertInto("connections").values({ legacy_mongo_id: null, from_user_id: userId, to_user_id: targetId, pair_key: [userId, targetId].sort().join(":"), status: "pending" }).returningAll().executeTakeFirstOrThrow();
  await transaction.insertInto("outbox_events").values({ legacy_mongo_id: null, type: "connection.requested", aggregate_id: row.id, payload: { senderId: userId, recipientId: targetId }, status: "pending", attempts: 0, next_attempt_at: now, claim_token: null, claim_until: null, last_error: "" }).execute();
  return { id: row.id, _id: row.id, from_user_id: row.from_user_id, to_user_id: row.to_user_id, status: row.status };
});

const usersByIds = async (ids: string[]): Promise<Map<string, PublicUser>> => {
  const unique = [...new Set(ids)]; const rows = unique.length ? await database.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url"]).where("id", "in", unique).execute() : [];
  return new Map(rows.map((row) => [row.id, brief(row)]));
};

export const getUserConnectionsData = async (userId: string) => {
  const [connections, followers, following, pending] = await Promise.all([
    database.selectFrom("connections").selectAll().where("status", "=", "accepted").where((expression) => expression.or([expression("from_user_id", "=", userId), expression("to_user_id", "=", userId)])).orderBy("created_at", "desc").limit(200).execute(),
    database.selectFrom("user_follows").selectAll().where("followee_id", "=", userId).orderBy("created_at", "desc").limit(200).execute(),
    database.selectFrom("user_follows").selectAll().where("follower_id", "=", userId).orderBy("created_at", "desc").limit(200).execute(),
    database.selectFrom("connections").selectAll().where("to_user_id", "=", userId).where("status", "=", "pending").orderBy("created_at", "desc").limit(100).execute(),
  ]);
  const connectionIds = connections.map((row) => row.from_user_id === userId ? row.to_user_id : row.from_user_id);
  const byId = await usersByIds([...connectionIds, ...followers.map((row) => row.follower_id), ...following.map((row) => row.followee_id), ...pending.map((row) => row.from_user_id)]);
  return { connections: connectionIds.map((id) => byId.get(id)).filter((user): user is PublicUser => Boolean(user)), followers: followers.map((row) => byId.get(row.follower_id)).filter((user): user is PublicUser => Boolean(user)), following: following.map((row) => byId.get(row.followee_id)).filter((user): user is PublicUser => Boolean(user)), pendingConnections: pending.map((row) => byId.get(row.from_user_id)).filter((user): user is PublicUser => Boolean(user)) };
};

export type RelationshipSection = "connections" | "followers" | "following" | "pendingConnections";
export const getUserRelationshipPage = async (userId: string, section: RelationshipSection, pagination: Pagination): Promise<{ items: PublicUser[]; nextCursor: string | null }> => {
  let edges: Array<{ created_at: Date; target_id: string }>;
  if (section === "followers" || section === "following") {
    const ownerColumn = section === "followers" ? "followee_id" as const : "follower_id" as const; const targetColumn = section === "followers" ? "follower_id" as const : "followee_id" as const;
    let query = database.selectFrom("user_follows").select(["created_at", `${targetColumn} as target_id`]).where(ownerColumn, "=", userId);
    if (pagination.cursor) query = query.where((expression) => expression.or([expression("created_at", "<", pagination.cursor!.date), expression.and([expression("created_at", "=", pagination.cursor!.date), expression(targetColumn, "<", pagination.cursor!.id)])]));
    edges = await query.orderBy("created_at", "desc").orderBy(targetColumn, "desc").limit(pagination.limit + 1).execute();
  } else {
    let query = database.selectFrom("connections").select(["id", "created_at", "from_user_id", "to_user_id"])
      .where("status", "=", section === "pendingConnections" ? "pending" : "accepted")
      .where((expression) => section === "pendingConnections" ? expression("to_user_id", "=", userId) : expression.or([expression("from_user_id", "=", userId), expression("to_user_id", "=", userId)]));
    if (pagination.cursor) query = query.where((expression) => expression.or([expression("created_at", "<", pagination.cursor!.date), expression.and([expression("created_at", "=", pagination.cursor!.date), expression("id", "<", pagination.cursor!.id)])]));
    const rows = await query.orderBy("created_at", "desc").orderBy("id", "desc").limit(pagination.limit + 1).execute();
    edges = rows.map((row) => ({ created_at: row.created_at, target_id: section === "pendingConnections" ? row.from_user_id : row.from_user_id === userId ? row.to_user_id : row.from_user_id }));
  }
  const hasMore = edges.length > pagination.limit; const selected = hasMore ? edges.slice(0, pagination.limit) : edges; const byId = await usersByIds(selected.map((edge) => edge.target_id));
  const last = selected.at(-1); return { items: selected.map((edge) => byId.get(edge.target_id)).filter((user): user is PublicUser => Boolean(user)), nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ date: new Date(last.created_at).toISOString(), id: last.target_id })).toString("base64url") : null };
};

export const acceptConnection = async (userId: string, senderId: string) => withTransaction(async (transaction) => {
  const row = await transaction.selectFrom("connections").selectAll().where("from_user_id", "=", senderId).where("to_user_id", "=", userId).where("status", "in", ["pending", "accepted"]).forUpdate().executeTakeFirst();
  if (!row) return null; if (row.status === "accepted") return row;
  const first = await transaction.updateTable("users").set((expression) => ({ connections_count: expression("connections_count", "+", 1) })).where("id", "=", userId).where("connections_count", "<", MAX_RELATIONSHIPS).executeTakeFirst();
  const second = await transaction.updateTable("users").set((expression) => ({ connections_count: expression("connections_count", "+", 1) })).where("id", "=", senderId).where("connections_count", "<", MAX_RELATIONSHIPS).executeTakeFirst();
  if (Number(first.numUpdatedRows) !== 1 || Number(second.numUpdatedRows) !== 1) throw Object.assign(new Error("Connection limit reached"), { status: 409 });
  return transaction.updateTable("connections").set({ status: "accepted" }).where("id", "=", row.id).returningAll().executeTakeFirst();
});

export const removeConnection = async (userId: string, targetId: string): Promise<boolean> => withTransaction(async (transaction) => {
  const deleted = await transaction.deleteFrom("connections").where("pair_key", "=", [userId, targetId].sort().join(":")).where("status", "=", "accepted").returning("id").executeTakeFirst();
  if (!deleted) return false;
  for (const id of [userId, targetId]) await transaction.updateTable("users").set((expression) => ({ connections_count: expression.fn<number>("greatest", [expression("connections_count", "-", 1), expression.val(0)]) })).where("id", "=", id).execute();
  return true;
});

/**
 * Cached per viewer, because what a profile shows depends on who is looking:
 * a private account's posts, its location label and its message button all
 * differ by relationship. Mixing viewers into one entry would be a privacy bug,
 * so the viewer is part of the field rather than dropped for a better hit rate.
 *
 * All of a profile's entries live under one owner key, so an edit or a follow
 * drops them for every viewer at once with a single `DEL`.
 */
export const getUserProfileAndPosts = async (profileId: string, requesterId: string, pagination: Pagination) => {
  const owner = profileCacheOwner(profileId);
  const field = `${requesterId}:${pagination.cursor?.date.toISOString() ?? "first"}:${pagination.cursor?.id ?? ""}:${pagination.limit}`;
  const cached = await getCachedField<Awaited<ReturnType<typeof buildProfileAndPosts>>>(owner, field); if (cached) return cached;
  const result = await buildProfileAndPosts(profileId, requesterId, pagination);
  if (result) await setCachedField(owner, field, result, PROFILE_CACHE_TTL_SECONDS);
  return result;
};

/**
 * A locked account still shows its header - name, avatar, bio and counts - so
 * the app can render "Bu hesap gizli" next to a working Follow button, exactly
 * as Instagram does. Only the posts are withheld, and they are withheld here in
 * the query rather than filtered by the client.
 */
const buildProfileAndPosts = async (profileId: string, requesterId: string, pagination: Pagination) => {
  const row = await database.selectFrom("users").selectAll().where("id", "=", profileId).executeTakeFirst(); if (!row) return null;
  const owner = profileId === requesterId;
  const [relationship, messagePermission] = await Promise.all([
    getRelationshipState(requesterId, profileId),
    owner ? Promise.resolve({ allowed: false }) : evaluateMessagePermission({ id: requesterId }, profileId),
  ]);
  const { isFollowing, isFollowedBy, requestSent, requestReceived, isConnection, connectionPending } = relationship;
  const isPrivate = !row.privacy_public_profile;
  const canViewContent = owner || !isPrivate || isFollowing || isConnection;

  const visibility: Array<"public" | "followers" | "private"> = owner
    ? ["public", "followers", "private"]
    : isFollowing || isConnection ? ["public", "followers"] : ["public"];
  let selected: Array<Row<"posts">> = [];
  let hasMore = false;
  if (canViewContent) {
    let query = database.selectFrom("posts").selectAll().where("user_id", "=", profileId).where("visibility", "in", visibility);
    if (pagination.cursor) query = query.where((expression) => expression.or([expression("created_at", "<", pagination.cursor!.date), expression.and([expression("created_at", "=", pagination.cursor!.date), expression("id", "<", pagination.cursor!.id)])]));
    const postRows = await query.orderBy("created_at", "desc").orderBy("id", "desc").limit(pagination.limit + 1).execute();
    hasMore = postRows.length > pagination.limit;
    selected = hasMore ? postRows.slice(0, pagination.limit) : postRows;
  }

  const internal = serializeUser(row);
  // The label is withheld from anyone the member did not open it to, and the
  // dataset ids behind it never leave the owner's own payload at all.
  const locationVisible = owner || row.location_visibility === "public"
    || (row.location_visibility === "followers" && (isFollowing || isConnection))
    || (row.location_visibility === "connections" && isConnection);
  const profile: UserProfile = {
    id: internal.id, _id: internal._id, full_name: internal.full_name, username: internal.username,
    profile_picture: internal.profile_picture, bio: internal.bio, cover_photo: internal.cover_photo,
    location: locationVisible ? internal.location : "", profileLocation: owner ? internal.profileLocation : null,
    weight: internal.weight, height: internal.height,
    followers_count: internal.followers_count, following_count: internal.following_count, connections_count: internal.connections_count,
    statistics: internal.statistics, createdAt: internal.createdAt, updatedAt: internal.updatedAt,
    isFollowing, isConnection, connectionPending, isFollowedBy, requestSent, requestReceived,
    isPrivate, canViewContent, canMessage: owner ? false : messagePermission.allowed,
  };
  const last = selected.at(-1);
  return {
    restricted: false as const,
    profile,
    posts: canViewContent ? await hydratePostInteractions(await hydratePosts(selected), requesterId) : [],
    nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ date: new Date(last.created_at).toISOString(), id: last.id })).toString("base64url") : null,
  };
};

export const getSuggestedUsersList = async (userId: string, requestedLimit = 10) => {
  const limit = Math.min(Math.max(Number(requestedLimit) || 10, 1), 50);
  const rows = await database.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url", "bio", "location", "location_visibility", "followers_count", "following_count", "connections_count"]).where("id", "!=", userId).where("privacy_show_in_search", "=", true)
    .where(sql<boolean>`not exists (select 1 from user_follows uf where uf.follower_id = ${userId} and uf.followee_id = users.id)`)
    // Someone already waiting on this member's approval is not a suggestion.
    .where(sql<boolean>`not exists (select 1 from follow_requests fr where fr.requester_id = ${userId} and fr.target_id = users.id)`)
    .orderBy("created_at", "desc").orderBy("id", "desc").limit(limit).execute();
  return withRelationships(rows.map(summary), userId);
};
