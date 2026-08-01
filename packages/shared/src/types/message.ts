import type { EntityId, IdempotentRequest, Timestamped } from "./common.js";
import type { PublicUser } from "./user.js";

export interface Message extends Timestamped, IdempotentRequest {
  id: EntityId;
  _id: EntityId;
  conversationId: EntityId;
  from_user_id: PublicUser | EntityId;
  to_user_id: PublicUser | EntityId;
  text: string;
  message_type: "text" | "image";
  media_url: string;
  seen: boolean;
}

export interface Conversation {
  conversationId: EntityId;
  partner: PublicUser;
  lastMessage: Message;
  unreadCount: number;
}

export interface Notification extends Timestamped {
  id: EntityId;
  type: string;
  actor: PublicUser | null;
  read: boolean;
  payload: Record<string, string | number | boolean | null>;
}

export interface ClientToServerEvents {
  send_message: (payload: { to_user_id: EntityId; text: string; operationId: string }) => void;
  typing_start: (payload: { to_user_id: EntityId }) => void;
  typing_stop: (payload: { to_user_id: EntityId }) => void;
}

export interface ServerToClientEvents {
  message_received: (message: Message) => void;
  message_sent: (message: Message) => void;
  message_deleted: (payload: { messageId: EntityId }) => void;
  messages_seen: (payload: { by_user_id: EntityId }) => void;
  online_users: (userIds: EntityId[]) => void;
  user_online: (payload: { userId: EntityId }) => void;
  user_offline: (payload: { userId: EntityId }) => void;
  typing_start: (payload: { from_user_id: EntityId }) => void;
  typing_stop: (payload: { from_user_id: EntityId }) => void;
  message_error: (payload: { message: string; operationId: string }) => void;
}
