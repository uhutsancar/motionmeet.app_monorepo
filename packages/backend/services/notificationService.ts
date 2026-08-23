import type { Notification, PublicUser } from "@motionmeet/shared";
import { database, type DatabaseTransaction } from "../configs/database.js";
import type { NotificationType, Row } from "../db/types.js";
import { toIsoString } from "../repositories/entities.js";
import { publicUser } from "../repositories/postRepository.js";
import { emitToUser } from "../realtime/socketRegistry.js";
import type { Pagination } from "../utils/pagination.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

interface NotificationInput {
  /** Recipient. */
  userId: string;
  /** Who caused it. */
  actorId: string;
  type: NotificationType;
  postId?: string | null;
  storyId?: string | null;
}

const MAX_PAGE = 50;

/**
 * Writes one activity row, refreshing an existing one instead of stacking a
 * duplicate. Unliking and re-liking the same post therefore moves the row back
 * to the top rather than adding a second entry, and marks it unread again.
 *
 * Self-notifications are dropped: liking your own post is not an event.
 */
export const recordNotification = async (
  input: NotificationInput,
  { transaction }: { transaction?: DatabaseTransaction } = {},
): Promise<Row<"notifications"> | null> => {
  if (input.userId === input.actorId) return null;
  const executor = transaction ?? database;
  return await executor
    .insertInto("notifications")
    .values({
      user_id: input.userId,
      actor_id: input.actorId,
      type: input.type,
      post_id: input.postId ?? null,
      story_id: input.storyId ?? null,
      read_at: null,
    })
    .onConflict((conflict) =>
      conflict
        .columns(["user_id", "actor_id", "type", "post_id", "story_id"])
        .doUpdateSet({ created_at: new Date(), read_at: null }),
    )
    .returningAll()
    .executeTakeFirst() ?? null;
};

export const countUnread = async (userId: string): Promise<number> =>
  Number(
    (
      await database
        .selectFrom("notifications")
        .select((expression) => expression.fn.countAll<number>().as("count"))
        .where("user_id", "=", userId)
        .where("read_at", "is", null)
        .executeTakeFirst()
    )?.count ?? 0,
  );

/**
 * Rows only make sense next to the person who caused them, so the actor is
 * hydrated here; pending follow requests are flagged so the activity list can
 * offer Confirm/Delete on the row itself.
 */
const hydrate = async (rows: Array<Row<"notifications">>, recipientId: string): Promise<Notification[]> => {
  if (!rows.length) return [];
  const actorIds = [...new Set(rows.map((row) => row.actor_id))];
  const requestSenders = rows.some((row) => row.type === "follow_request") ? actorIds : [];
  const [actorRows, pendingRows] = await Promise.all([
    database
      .selectFrom("users")
      .select(["id", "full_name", "username", "profile_picture_url"])
      .where("id", "in", actorIds)
      .execute(),
    requestSenders.length
      ? database
          .selectFrom("follow_requests")
          .select("requester_id")
          .where("target_id", "=", recipientId)
          .where("requester_id", "in", requestSenders)
          .execute()
      : [],
  ]);
  const actorById = new Map<string, PublicUser>(
    actorRows.map((row) => [row.id, publicUser(row.id, row.full_name, row.username, row.profile_picture_url)]),
  );
  const stillPending = new Set(pendingRows.map((row) => row.requester_id));
  return rows.map((row) => ({
    id: row.id,
    _id: row.id,
    type: row.type,
    actor: actorById.get(row.actor_id) ?? null,
    read: row.read_at !== null,
    postId: row.post_id,
    storyId: row.story_id,
    actionable: row.type === "follow_request" && stillPending.has(row.actor_id),
    payload: {},
    createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString(),
  }));
};

export const getNotificationsPage = async (
  userId: string,
  pagination: Pagination,
): Promise<{ items: Notification[]; nextCursor: string | null; unreadCount: number }> => {
  const limit = Math.min(pagination.limit, MAX_PAGE);
  let query = database.selectFrom("notifications").selectAll().where("user_id", "=", userId);
  if (pagination.cursor) {
    query = query.where((expression) =>
      expression.or([
        expression("created_at", "<", pagination.cursor!.date),
        expression.and([
          expression("created_at", "=", pagination.cursor!.date),
          expression("id", "<", pagination.cursor!.id),
        ]),
      ]),
    );
  }
  const rows = await query.orderBy("created_at", "desc").orderBy("id", "desc").limit(limit + 1).execute();
  const hasMore = rows.length > limit;
  const selected = hasMore ? rows.slice(0, limit) : rows;
  const [items, unreadCount] = await Promise.all([hydrate(selected, userId), countUnread(userId)]);
  const last = selected.at(-1);
  return {
    items,
    nextCursor:
      hasMore && last
        ? Buffer.from(JSON.stringify({ date: new Date(last.created_at).toISOString(), id: last.id })).toString("base64url")
        : null,
    unreadCount,
  };
};

export const markAllRead = async (userId: string): Promise<void> => {
  await database
    .updateTable("notifications")
    .set({ read_at: new Date() })
    .where("user_id", "=", userId)
    .where("read_at", "is", null)
    .execute();
};

/** Drops the row a follow request created once it is accepted or declined. */
export const clearFollowRequestNotification = async (
  recipientId: string,
  actorId: string,
  { transaction }: { transaction?: DatabaseTransaction } = {},
): Promise<void> => {
  await (transaction ?? database)
    .deleteFrom("notifications")
    .where("user_id", "=", recipientId)
    .where("actor_id", "=", actorId)
    .where("type", "=", "follow_request")
    .execute();
};

/**
 * Pushes a freshly written row to the recipient's open sockets. Delivery is
 * best-effort: a failure here must never roll back the action that caused it,
 * because the row is already durable and the next fetch will show it.
 */
export const publishNotification = async (row: Row<"notifications"> | null): Promise<void> => {
  if (!row) return;
  try {
    const [items, unreadCount] = await Promise.all([hydrate([row], row.user_id), countUnread(row.user_id)]);
    const notification = items[0];
    if (notification) emitToUser(row.user_id, "notification_received", { notification, unreadCount });
  } catch (error: unknown) {
    logger.warn("notification_publish_failed", safeErrorMetadata(error));
  }
};

export const recordAndPublish = async (input: NotificationInput): Promise<void> => {
  await publishNotification(await recordNotification(input));
};
