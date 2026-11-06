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
  /**
   * Position in the conversation, assigned at commit order. Not contiguous:
   * deletions take numbers from the same counter. Absent from servers older
   * than the message sync release.
   */
  seq?: number;
}

/**
 * `POST /api/message/sync`: what happened in one conversation after
 * `afterSeq`. Messages and deletions are one event stream cut at one limit;
 * the next request continues from `nextAfterSeq` (never from `latestSeq`).
 */
export interface MessageSyncRequest {
  to_user_id: EntityId;
  /** The conversation the client's cursor belongs to; null when it has none yet. */
  conversationId?: EntityId | null;
  afterSeq: number;
  /** 1..200, default 100. */
  limit?: number;
}

export interface MessageSyncResult {
  /** The conversation as the server knows it now. */
  conversationId: EntityId | null;
  /** The two members have no conversation (never had one, or it was deleted). */
  conversationGone: boolean;
  /** The cursor cannot be continued; reload the conversation from its newest page. */
  resyncRequired: boolean;
  /** Message events in this page, oldest first. */
  messages: Message[];
  /** Deletion events in this page. Ids the client does not hold can be ignored. */
  deletedMessageIds: EntityId[];
  /** Cursor for the next request: the position of the last event in this page. */
  nextAfterSeq: number;
  hasMore: boolean;
  /** The conversation's newest position in this snapshot. Informational only. */
  latestSeq: number;
  /** The partner has read every message to them up to this position. */
  partnerLastReadSeq: number;
}

export interface Conversation {
  conversationId: EntityId;
  partner: PublicUser;
  lastMessage: Message;
  unreadCount: number;
}

export type NotificationType =
  | "follow_request"
  | "follow_request_accepted"
  | "follow"
  | "post_like"
  | "post_comment"
  | "story_like";

export interface Notification extends Timestamped {
  id: EntityId;
  _id: EntityId;
  type: NotificationType;
  actor: PublicUser | null;
  read: boolean;
  /** Present on post_like / post_comment so the row can deep-link. */
  postId: EntityId | null;
  /** Present on story_like. A story expires, so the row may outlive its target. */
  storyId: EntityId | null;
  /**
   * Only set on `follow_request` rows, and only while the request is still
   * pending, so the row can offer Confirm/Delete inline.
   */
  actionable: boolean;
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
  /** `lastReadSeq`: the reader has seen every message to them up to this position (absent from older servers). */
  messages_seen: (payload: { by_user_id: EntityId; lastReadSeq?: number }) => void;
  online_users: (userIds: EntityId[]) => void;
  user_online: (payload: { userId: EntityId }) => void;
  user_offline: (payload: { userId: EntityId }) => void;
  typing_start: (payload: { from_user_id: EntityId }) => void;
  typing_stop: (payload: { from_user_id: EntityId }) => void;
  message_error: (payload: { message: string; operationId: string }) => void;
  /** A new activity row landed; carries the unread total so the bell can badge. */
  notification_received: (payload: { notification: Notification; unreadCount: number }) => void;
  /**
   * The viewer's relationship with `userId` changed from the other side — a
   * request was accepted, or someone followed or unfollowed them. Lets both
   * devices re-render follow buttons without a refetch.
   */
  relationship_changed: (payload: { userId: EntityId; isFollowing: boolean; isFollowedBy: boolean; requestSent: boolean; requestReceived: boolean }) => void;
}
