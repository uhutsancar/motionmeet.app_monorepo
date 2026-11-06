import type { Conversation, Message, MessageSyncResult, PublicUser } from "@motionmeet/shared";
import { sql } from "kysely";
import { database, withTransaction, type DatabaseTransaction } from "../configs/database.js";
import type { Row } from "../db/types.js";
import type { InternalUser } from "../repositories/entities.js";
import { toIsoString } from "../repositories/entities.js";
import { publicUser } from "../repositories/postRepository.js";
import type { Pagination } from "../utils/pagination.js";
import { isUserId } from "../utils/validation.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";
import { commitReservedUploads } from "./mediaUploadService.js";
import { evaluateMessagePermission, type MessagePermission } from "./accessControlService.js";

export interface MessageAccess { id: string; _id: string; conversationId: string; from_user_id: string; to_user_id: string; media_url: string; media_key: string; seen: boolean }
export const conversationPairKey = (left: string, right: string): string => [left, right].sort().join(":");

const hydrateMessages = async (rows: Array<Row<"messages">>, transaction: DatabaseTransaction | typeof database = database): Promise<Message[]> => {
  const ids = [...new Set(rows.flatMap((row) => [row.from_user_id, row.to_user_id]))];
  const users = ids.length ? await transaction.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url"]).where("id", "in", ids).execute() : [];
  const byId = new Map<string, PublicUser>(users.map((user) => [user.id, publicUser(user.id, user.full_name, user.username, user.profile_picture_url)]));
  return rows.map((row) => ({ id: row.id, _id: row.id, operationId: row.operation_id, conversationId: row.conversation_id, seq: Number(row.seq), from_user_id: byId.get(row.from_user_id) ?? row.from_user_id, to_user_id: byId.get(row.to_user_id) ?? row.to_user_id, text: row.text, message_type: row.message_type, media_url: row.media_url, seen: row.seen, createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(), updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString() }));
};

/**
 * How far `readerId` has read the messages sent to them, as a sequence
 * number: one before the first message to them that is still unseen, or the
 * conversation's last number when nothing is unseen.
 *
 * Derived from `messages.seen` at query time, so the previous release's
 * seen-marking (still running during a rolling deploy) is reflected too.
 * `markMessagesSeen` marks every unseen message at once, so the seen set is a
 * prefix in practice; when it is not, this answer is conservative - it can
 * show fewer messages as seen, never more. A member's own messages never move
 * the other side's read position.
 */
const readPosition = async (executor: DatabaseTransaction | typeof database, conversationId: string, readerId: string): Promise<number> => {
  const { rows } = await sql<{ position: string | null }>`
    select coalesce(
      (select min(seq) - 1 from messages where conversation_id = ${conversationId}::uuid and to_user_id = ${readerId}::uuid and not seen),
      (select last_seq from conversations where id = ${conversationId}::uuid)
    )::text as position`.execute(executor);
  return Number(rows[0]?.position ?? 0);
};

/**
 * A public account can be messaged by anyone it has not switched messages off
 * for. A private account needs a mutual follow, so both sides have opted in;
 * an existing accepted connection still counts.
 *
 * Applied on the REST send path, the socket send path and the typing indicator,
 * so there is no route into a stranger's inbox.
 */
export const describeSendPermission = async (sender: InternalUser | undefined, recipientId: unknown): Promise<MessagePermission> => {
  const senderId = sender?.id;
  if (!senderId || !isUserId(recipientId)) return { allowed: false, reason: "invalid_recipient" };
  return evaluateMessagePermission({ id: senderId, role: sender.role }, recipientId);
};

export const canSendToUser = async (sender: InternalUser | undefined, recipientId: unknown): Promise<boolean> =>
  (await describeSendPermission(sender, recipientId)).allowed;

export const findMessageByOperation = async (userId: string, operationId: string): Promise<Message | null> => {
  const row = await database.selectFrom("messages").selectAll().where("from_user_id", "=", userId).where("operation_id", "=", operationId).executeTakeFirst();
  return row ? (await hydrateMessages([row]))[0] ?? null : null;
};

interface NewMessage { from_user_id: string; to_user_id: string; operationId: string; text: string; message_type: "text" | "image"; media_url: string; media_key: string; seen?: boolean }
const uniqueViolation = (error: unknown): boolean => Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");

export const createMessage = async (input: NewMessage, { reservationKeys = [] }: { reservationKeys?: string[] } = {}): Promise<Message> => {
  try {
    return await withTransaction(async (transaction) => {
      const existing = await transaction.selectFrom("messages").selectAll().where("from_user_id", "=", input.from_user_id).where("operation_id", "=", input.operationId).executeTakeFirst();
      if (existing) return (await hydrateMessages([existing], transaction))[0]!;
      const pairKey = conversationPairKey(input.from_user_id, input.to_user_id);
      const conversation = await transaction.insertInto("conversations").values({ legacy_mongo_id: null, pair_key: pairKey, last_message_id: null, last_message_at: null })
        .onConflict((conflict) => conflict.column("pair_key").doUpdateSet({ pair_key: pairKey })).returning("id").executeTakeFirstOrThrow();
      for (const userId of [input.from_user_id, input.to_user_id]) await transaction.insertInto("conversation_participants").values({ conversation_id: conversation.id, user_id: userId, unread_count: 0 }).onConflict((conflict) => conflict.columns(["conversation_id", "user_id"]).doNothing()).execute();
      const row = await transaction.insertInto("messages").values({ legacy_mongo_id: null, conversation_id: conversation.id, operation_id: input.operationId, from_user_id: input.from_user_id, to_user_id: input.to_user_id, text: input.text, message_type: input.message_type, media_url: input.media_url, media_key: input.media_key, seen: input.seen ?? false }).returningAll().executeTakeFirstOrThrow();
      await commitReservedUploads(reservationKeys, { transaction, userId: input.from_user_id });
      await transaction.updateTable("conversations").set({ last_message_id: row.id, last_message_at: row.created_at }).where("id", "=", conversation.id).execute();
      await transaction.updateTable("conversation_participants").set((expression) => ({ unread_count: expression("unread_count", "+", 1) })).where("conversation_id", "=", conversation.id).where("user_id", "=", input.to_user_id).execute();
      return (await hydrateMessages([row], transaction))[0]!;
    });
  } catch (error: unknown) {
    if (!uniqueViolation(error)) throw error;
    const existing = await findMessageByOperation(input.from_user_id, input.operationId); if (!existing) throw error; return existing;
  }
};

/**
 * Marks everything `senderId` sent to `userId` as seen. Returns `userId`'s read
 * position afterwards (for the sender's `messages_seen` event), or null when
 * the two have no conversation.
 */
export const markMessagesSeen = async (userId: string, senderId: string): Promise<number | null> => withTransaction(async (transaction) => {
  const conversation = await transaction.selectFrom("conversations").select("id").where("pair_key", "=", conversationPairKey(userId, senderId)).executeTakeFirst(); if (!conversation) return null;
  await transaction.updateTable("messages").set({ seen: true }).where("conversation_id", "=", conversation.id).where("to_user_id", "=", userId).where("seen", "=", false).execute();
  await transaction.updateTable("conversation_participants").set({ unread_count: 0 }).where("conversation_id", "=", conversation.id).where("user_id", "=", userId).execute();
  return readPosition(transaction, conversation.id, userId);
});

/**
 * `readSeq` is set only when this call marked the conversation read (the
 * first page); the caller tells the partner then, and only then.
 */
export const getChatMessagesList = async (userId: string, recipientId: string, pagination: Pagination): Promise<{ items: Message[]; nextCursor: string | null; readSeq: number | null }> => {
  const conversation = await database.selectFrom("conversations").select("id").where("pair_key", "=", conversationPairKey(userId, recipientId)).executeTakeFirst();
  if (!conversation) return { items: [], nextCursor: null, readSeq: null };
  let query = database.selectFrom("messages").selectAll().where("conversation_id", "=", conversation.id);
  if (pagination.cursor) query = query.where((expression) => expression.or([expression("created_at", "<", pagination.cursor!.date), expression.and([expression("created_at", "=", pagination.cursor!.date), expression("id", "<", pagination.cursor!.id)])]));
  const rows = await query.orderBy("created_at", "desc").orderBy("id", "desc").limit(pagination.limit + 1).execute();
  const hasMore = rows.length > pagination.limit; const selected = hasMore ? rows.slice(0, pagination.limit) : rows; const last = selected.at(-1);
  // Only opening the conversation marks it read. Paging further back is
  // scrolling through history that was already seen, and running the seen
  // transaction again for each of those pages is a write per scroll.
  const items = (await hydrateMessages(selected)).reverse();
  const readSeq = pagination.cursor ? null : await markMessagesSeen(userId, recipientId);
  return { items, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ date: new Date(last.created_at).toISOString(), id: last.id })).toString("base64url") : null, readSeq };
};

export const MESSAGE_SYNC_DEFAULT_LIMIT = 100;
export const MESSAGE_SYNC_MAX_LIMIT = 200;

/**
 * Everything that happened in a conversation after `afterSeq`: new messages
 * and deletions, as one stream ordered by sequence number and cut at one
 * limit, so a page never holds a deletion without the messages before it.
 * See ADR 005 for the client side.
 *
 * All reads share one REPEATABLE READ snapshot, so `latestSeq`, the events
 * and the partner's read position describe the same moment. Sequence numbers
 * are handed out under the conversation row's lock and committed with the
 * counter, so a snapshot that sees `last_seq = N` sees every event up to N.
 *
 * Read-only: it marks nothing seen and emits nothing.
 *
 * The conversation is found from the caller's own id and the partner's, so a
 * caller can only ever sync a conversation they are part of.
 */
export const syncConversationMessages = async (
  userId: string,
  partnerId: string,
  { afterSeq, conversationId, limit }: { afterSeq: number; conversationId: string | null; limit: number },
): Promise<MessageSyncResult> => database.transaction().setIsolationLevel("repeatable read").setAccessMode("read only").execute(async (transaction) => {
  const conversation = await transaction.selectFrom("conversations as conversation")
    .innerJoin("conversation_participants as participant", (join) => join.onRef("participant.conversation_id", "=", "conversation.id").on("participant.user_id", "=", userId))
    .select(["conversation.id", "conversation.last_seq", "conversation.tombstone_floor_seq"])
    .where("conversation.pair_key", "=", conversationPairKey(userId, partnerId))
    .executeTakeFirst();
  if (!conversation) {
    return { conversationId: null, conversationGone: true, resyncRequired: false, messages: [], deletedMessageIds: [], nextAfterSeq: 0, hasMore: false, latestSeq: 0, partnerLastReadSeq: 0 };
  }
  const latestSeq = Number(conversation.last_seq);
  const partnerLastReadSeq = await readPosition(transaction, conversation.id, partnerId);
  // The conversation was deleted and started again between the same two
  // members (numbering restarted at 1), the deletions between `afterSeq` and
  // the floor have been purged, or the cursor belongs to something else
  // entirely: in all three cases the client's list cannot be patched.
  const resyncRequired = (conversationId !== null && conversationId !== conversation.id)
    || (afterSeq > 0 && afterSeq < Number(conversation.tombstone_floor_seq))
    || afterSeq > latestSeq;
  if (resyncRequired) {
    return { conversationId: conversation.id, conversationGone: false, resyncRequired: true, messages: [], deletedMessageIds: [], nextAfterSeq: afterSeq, hasMore: false, latestSeq, partnerLastReadSeq };
  }

  // Ordered by the bigint position; it is only turned into text for the
  // driver afterwards, under another name, so the sort stays numeric.
  const { rows: events } = await sql<{ kind: "message" | "deletion"; event_seq: string; ref: string }>`
    select kind, position::text as event_seq, ref from (
      select 'message' as kind, seq as position, id as ref from messages where conversation_id = ${conversation.id}::uuid and seq > ${afterSeq}
      union all
      select 'deletion', change_seq, message_id from message_deletions where conversation_id = ${conversation.id}::uuid and change_seq > ${afterSeq}
    ) events
    order by position
    limit ${limit + 1}`.execute(transaction);
  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  const messageIds = page.filter((event) => event.kind === "message").map((event) => event.ref);
  const rows = messageIds.length ? await transaction.selectFrom("messages").selectAll().where("id", "in", messageIds).orderBy("seq").execute() : [];
  return {
    conversationId: conversation.id,
    conversationGone: false,
    resyncRequired: false,
    messages: await hydrateMessages(rows, transaction),
    deletedMessageIds: page.filter((event) => event.kind === "deletion").map((event) => event.ref),
    nextAfterSeq: page.length ? Number(page[page.length - 1]!.event_seq) : afterSeq,
    hasMore,
    latestSeq,
    partnerLastReadSeq,
  };
});

export const getUserConversationsList = async (userId: string, pagination: Pagination): Promise<{ items: Conversation[]; nextCursor: string | null }> => {
  let query = database.selectFrom("conversation_participants as participant").innerJoin("conversations as conversation", "conversation.id", "participant.conversation_id")
    .select(["conversation.id", "conversation.last_message_id", "conversation.last_message_at", "participant.unread_count"]).where("participant.user_id", "=", userId).where("conversation.last_message_id", "is not", null);
  if (pagination.cursor) query = query.where((expression) => expression.or([expression("conversation.last_message_at", "<", pagination.cursor!.date), expression.and([expression("conversation.last_message_at", "=", pagination.cursor!.date), expression("conversation.id", "<", pagination.cursor!.id)])]));
  const rows = await query.orderBy("conversation.last_message_at", "desc").orderBy("conversation.id", "desc").limit(pagination.limit + 1).execute();
  const hasMore = rows.length > pagination.limit; const selected = hasMore ? rows.slice(0, pagination.limit) : rows;
  const messageIds = selected.map((row) => row.last_message_id).filter((id): id is string => Boolean(id));
  const messageRows = messageIds.length ? await database.selectFrom("messages").selectAll().where("id", "in", messageIds).execute() : [];
  const messages = await hydrateMessages(messageRows); const byId = new Map(messages.map((message) => [message.id, message]));
  const items: Conversation[] = selected.flatMap((row) => {
    const message = row.last_message_id ? byId.get(row.last_message_id) : null; if (!message) return [];
    const from = typeof message.from_user_id === "string" ? null : message.from_user_id; const to = typeof message.to_user_id === "string" ? null : message.to_user_id;
    const partner = from?.id === userId ? to : from; return partner ? [{ conversationId: row.id, partner, lastMessage: message, unreadCount: row.unread_count }] : [];
  });
  const last = selected.at(-1); return { items, nextCursor: hasMore && last?.last_message_at ? Buffer.from(JSON.stringify({ date: new Date(last.last_message_at).toISOString(), id: last.id })).toString("base64url") : null };
};

export const getRecentMessages = async (userId: string): Promise<Message[]> => {
  const rows = await database.selectFrom("messages").selectAll().where("to_user_id", "=", userId).orderBy("created_at", "desc").orderBy("id", "desc").limit(50).execute(); return hydrateMessages(rows);
};
export const getMessageById = async (messageId: string): Promise<MessageAccess | null> => {
  const row = await database.selectFrom("messages").selectAll().where("id", "=", messageId).executeTakeFirst();
  return row ? { id: row.id, _id: row.id, conversationId: row.conversation_id, from_user_id: row.from_user_id, to_user_id: row.to_user_id, media_url: row.media_url, media_key: row.media_key, seen: row.seen } : null;
};

export const deleteMessageById = async (message: MessageAccess): Promise<void> => withTransaction(async (transaction) => {
  const current = await transaction.selectFrom("messages").selectAll().where("id", "=", message.id).forUpdate().executeTakeFirst(); if (!current) return;
  const key = current.media_key || extractS3Key(current.media_url); if (key) await queueMediaDeletions([key], { transaction });
  // Read before the delete: the foreign key from conversations.last_message_id
  // is ON DELETE SET NULL, and PostgreSQL applies that action at once even on a
  // deferred constraint. Read afterwards, the pointer was already null, the
  // previous message was never promoted, and the whole thread vanished from
  // the inbox (the list skips conversations without a last message).
  const conversation = await transaction.selectFrom("conversations").select("last_message_id").where("id", "=", current.conversation_id).forUpdate().executeTakeFirst();
  await transaction.deleteFrom("messages").where("id", "=", current.id).execute();
  if (!current.seen) await transaction.updateTable("conversation_participants").set((expression) => ({ unread_count: expression.fn<number>("greatest", [expression("unread_count", "-", 1), expression.val(0)]) })).where("conversation_id", "=", current.conversation_id).where("user_id", "=", current.to_user_id).execute();
  if (conversation?.last_message_id !== current.id) return;
  const previous = await transaction.selectFrom("messages").select(["id", "created_at"]).where("conversation_id", "=", current.conversation_id).orderBy("created_at", "desc").orderBy("id", "desc").executeTakeFirst();
  if (!previous) await transaction.deleteFrom("conversations").where("id", "=", current.conversation_id).execute();
  else await transaction.updateTable("conversations").set({ last_message_id: previous.id, last_message_at: previous.created_at }).where("id", "=", current.conversation_id).execute();
});

export const MESSAGE_TOMBSTONE_RETENTION_DAYS = 30;
const TOMBSTONE_PURGE_BATCH = 5_000;

/**
 * Deletes tombstones older than `cutoff` (D-06: kept 30 days) and raises each
 * conversation's `tombstone_floor_seq` to the highest number it purged, so a
 * client whose cursor is older than that is told to resync instead of missing
 * deletions it can no longer be told about. Tombstones whose conversation is
 * gone are removed too. Batched with SKIP LOCKED like every scheduled task.
 */
export const purgeMessageTombstones = async (cutoff = new Date(Date.now() - MESSAGE_TOMBSTONE_RETENTION_DAYS * 86_400_000)): Promise<number> => {
  let purged = 0;
  for (;;) {
    const removed = await withTransaction(async (transaction) => {
      // The update in `raised` runs although the final select does not read
      // it: PostgreSQL always executes data-modifying CTEs to completion.
      const { rows } = await sql<{ removed: string }>`
        with doomed as (
          select message_id from message_deletions where deleted_at < ${cutoff}
          order by deleted_at limit ${TOMBSTONE_PURGE_BATCH} for update skip locked
        ), purged as (
          delete from message_deletions d using doomed where d.message_id = doomed.message_id
          returning d.conversation_id, d.change_seq
        ), floors as (
          select conversation_id, max(change_seq) as floor, count(*) as removed from purged group by conversation_id
        ), raised as (
          update conversations c set tombstone_floor_seq = greatest(c.tombstone_floor_seq, floors.floor)
          from floors where c.id = floors.conversation_id
        )
        select coalesce(sum(removed), 0)::text as removed from floors`.execute(transaction);
      return Number(rows[0]?.removed ?? 0);
    });
    purged += removed;
    if (removed < TOMBSTONE_PURGE_BATCH) break;
  }
  for (;;) {
    const { numDeletedRows } = await database.deleteFrom("message_deletions")
      .where("message_id", "in", (inner) => inner.selectFrom("message_deletions as orphan").select("orphan.message_id")
        .where(sql<boolean>`not exists (select 1 from conversations c where c.id = orphan.conversation_id)`).limit(TOMBSTONE_PURGE_BATCH))
      .executeTakeFirst();
    purged += Number(numDeletedRows);
    if (Number(numDeletedRows) < TOMBSTONE_PURGE_BATCH) break;
  }
  return purged;
};
