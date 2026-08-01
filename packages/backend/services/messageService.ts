import type { Conversation, Message, PublicUser } from "@motionmeet/shared";
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

export interface MessageAccess { id: string; _id: string; conversationId: string; from_user_id: string; to_user_id: string; media_url: string; media_key: string; seen: boolean }
export const conversationPairKey = (left: string, right: string): string => [left, right].sort().join(":");

const hydrateMessages = async (rows: Array<Row<"messages">>, transaction: DatabaseTransaction | typeof database = database): Promise<Message[]> => {
  const ids = [...new Set(rows.flatMap((row) => [row.from_user_id, row.to_user_id]))];
  const users = ids.length ? await transaction.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url"]).where("id", "in", ids).execute() : [];
  const byId = new Map<string, PublicUser>(users.map((user) => [user.id, publicUser(user.id, user.full_name, user.username, user.profile_picture_url)]));
  return rows.map((row) => ({ id: row.id, _id: row.id, operationId: row.operation_id, conversationId: row.conversation_id, from_user_id: byId.get(row.from_user_id) ?? row.from_user_id, to_user_id: byId.get(row.to_user_id) ?? row.to_user_id, text: row.text, message_type: row.message_type, media_url: row.media_url, seen: row.seen, createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(), updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString() }));
};

export const canSendToUser = async (sender: InternalUser | undefined, recipientId: unknown): Promise<boolean> => {
  const senderId = sender?.id;
  if (!senderId || !isUserId(recipientId) || recipientId === senderId) return false;
  const recipient = await database.selectFrom("users").select("id").where("id", "=", recipientId).where("privacy_allow_messages", "=", true).executeTakeFirst();
  if (!recipient) return false;
  const features = sender.plan && typeof sender.plan === "object" ? sender.plan.features : null;
  if (sender.role === "superadmin" || features?.can_message_anyone) return true;
  return Boolean(await database.selectFrom("connections").select("id").where("pair_key", "=", conversationPairKey(senderId, recipientId)).where("status", "=", "accepted").executeTakeFirst());
};

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

export const markMessagesSeen = async (userId: string, senderId: string): Promise<void> => withTransaction(async (transaction) => {
  const conversation = await transaction.selectFrom("conversations").select("id").where("pair_key", "=", conversationPairKey(userId, senderId)).executeTakeFirst(); if (!conversation) return;
  await transaction.updateTable("messages").set({ seen: true }).where("conversation_id", "=", conversation.id).where("to_user_id", "=", userId).where("seen", "=", false).execute();
  await transaction.updateTable("conversation_participants").set({ unread_count: 0 }).where("conversation_id", "=", conversation.id).where("user_id", "=", userId).execute();
});

export const getChatMessagesList = async (userId: string, recipientId: string, pagination: Pagination): Promise<{ items: Message[]; nextCursor: string | null }> => {
  const conversation = await database.selectFrom("conversations").select("id").where("pair_key", "=", conversationPairKey(userId, recipientId)).executeTakeFirst();
  if (!conversation) return { items: [], nextCursor: null };
  let query = database.selectFrom("messages").selectAll().where("conversation_id", "=", conversation.id);
  if (pagination.cursor) query = query.where((expression) => expression.or([expression("created_at", "<", pagination.cursor!.date), expression.and([expression("created_at", "=", pagination.cursor!.date), expression("id", "<", pagination.cursor!.id)])]));
  const rows = await query.orderBy("created_at", "desc").orderBy("id", "desc").limit(pagination.limit + 1).execute();
  const hasMore = rows.length > pagination.limit; const selected = hasMore ? rows.slice(0, pagination.limit) : rows; const last = selected.at(-1);
  const items = (await hydrateMessages(selected)).reverse(); await markMessagesSeen(userId, recipientId);
  return { items, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ date: new Date(last.created_at).toISOString(), id: last.id })).toString("base64url") : null };
};

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
  await transaction.deleteFrom("messages").where("id", "=", current.id).execute();
  if (!current.seen) await transaction.updateTable("conversation_participants").set((expression) => ({ unread_count: expression.fn<number>("greatest", [expression("unread_count", "-", 1), expression.val(0)]) })).where("conversation_id", "=", current.conversation_id).where("user_id", "=", current.to_user_id).execute();
  const conversation = await transaction.selectFrom("conversations").select("last_message_id").where("id", "=", current.conversation_id).executeTakeFirst();
  if (conversation?.last_message_id !== current.id) return;
  const previous = await transaction.selectFrom("messages").select(["id", "created_at"]).where("conversation_id", "=", current.conversation_id).orderBy("created_at", "desc").orderBy("id", "desc").executeTakeFirst();
  if (!previous) await transaction.deleteFrom("conversations").where("id", "=", current.conversation_id).execute();
  else await transaction.updateTable("conversations").set({ last_message_id: previous.id, last_message_at: previous.created_at }).where("id", "=", current.conversation_id).execute();
});
