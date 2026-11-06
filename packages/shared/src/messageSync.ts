import type { EntityId } from "./types/common.js";
import type { Message, MessageSyncResult } from "./types/message.js";

/**
 * Client side of message synchronisation (ADR 005), shared by web and mobile
 * so both apply exactly the same rules. Pure functions: no network, no state
 * of their own.
 *
 * A client keeps, per open conversation, `{ conversationId, cursor }`. The
 * cursor is the sequence number up to which it has applied every event -
 * messages and deletions. It only ever advances to a page's `nextAfterSeq`,
 * or by one for a socket message that is exactly the next number.
 */
export interface ConversationSyncState {
  conversationId: EntityId | null;
  cursor: number;
}

/** A sync that needs more pages than this starts over from the newest page instead. */
export const MESSAGE_SYNC_MAX_PAGES = 20;

const idOf = (message: Message): string => String(message._id ?? message.id);
const userIdOf = (value: Message["from_user_id"]): string => (typeof value === "string" ? value : String(value._id ?? value.id));

/** The highest sequence number in `messages`; 0 when none carries one. */
export const highestSeq = (messages: readonly Message[]): number =>
  messages.reduce((highest, message) => (typeof message.seq === "number" && message.seq > highest ? message.seq : highest), 0);

/** The state after loading a conversation's newest page through `/get`. */
export const initialSyncState = (messages: readonly Message[]): ConversationSyncState => ({
  conversationId: messages.find((message) => message.conversationId)?.conversationId ?? null,
  cursor: highestSeq(messages),
});

/**
 * Send order: by sequence number when both messages have one, otherwise by
 * creation time and id (messages from a server older than the sync release
 * carry no number).
 */
export const compareMessages = (left: Message, right: Message): number => {
  if (typeof left.seq === "number" && typeof right.seq === "number" && left.conversationId === right.conversationId) return left.seq - right.seq;
  return Date.parse(left.createdAt) - Date.parse(right.createdAt) || idOf(left).localeCompare(idOf(right));
};

/** Adds or refreshes `incoming` in `current` by id and returns the list in send order. */
export const mergeMessages = (current: readonly Message[], incoming: readonly Message[]): Message[] => {
  const byId = new Map(current.map((message) => [idOf(message), message]));
  for (const message of incoming) byId.set(idOf(message), message);
  return [...byId.values()].sort(compareMessages);
};

/**
 * Applies one sync page: new messages merged in, deleted ones removed (ids the
 * client never had are ignored), and the member's own messages up to the
 * partner's read position marked seen.
 */
export const applySyncPage = (
  current: readonly Message[],
  page: Pick<MessageSyncResult, "messages" | "deletedMessageIds" | "partnerLastReadSeq">,
  selfId: EntityId,
): Message[] => {
  const deleted = new Set(page.deletedMessageIds.map(String));
  const merged = mergeMessages(current.filter((message) => !deleted.has(idOf(message))), page.messages.filter((message) => !deleted.has(idOf(message))));
  return markSeenUpTo(merged, selfId, page.partnerLastReadSeq);
};

/**
 * The member's own messages numbered up to `lastReadSeq` become seen. Messages
 * without a number are left alone: there is no position to compare.
 */
export const markSeenUpTo = (messages: readonly Message[], selfId: EntityId, lastReadSeq: number): Message[] =>
  messages.map((message) => (!message.seen && typeof message.seq === "number" && message.seq <= lastReadSeq && userIdOf(message.from_user_id) === String(selfId)
    ? { ...message, seen: true }
    : message));

/**
 * What a message that arrived over the socket does to the cursor. While a
 * sync is running the cursor belongs to the sync and is left alone. The next
 * number in line advances it; a gap (a deletion in between, or something
 * missed) asks for a sync - an unnecessary sync is cheap, a missed message is
 * not. A message from another conversation than the cursor's (the thread was
 * deleted and started again) also asks for one.
 */
export const advanceForSocketMessage = (
  state: ConversationSyncState,
  message: Message,
  syncRunning: boolean,
): { state: ConversationSyncState; syncNeeded: boolean } => {
  if (syncRunning || typeof message.seq !== "number") return { state, syncNeeded: false };
  if (state.conversationId !== null && message.conversationId !== state.conversationId) return { state, syncNeeded: true };
  const conversationId = state.conversationId ?? message.conversationId ?? null;
  if (message.seq <= state.cursor) return { state: { conversationId, cursor: state.cursor }, syncNeeded: false };
  if (message.seq === state.cursor + 1) return { state: { conversationId, cursor: message.seq }, syncNeeded: false };
  return { state: { conversationId, cursor: state.cursor }, syncNeeded: true };
};

export type SyncOutcome =
  /** Caught up; `state` is the new cursor. */
  | { kind: "synced"; state: ConversationSyncState }
  /** The cursor cannot be continued (or it is too far behind): reload the newest page. */
  | { kind: "resync"; state: ConversationSyncState }
  /** The two members have no conversation any more: clear the list. */
  | { kind: "gone"; state: ConversationSyncState }
  /** The server has no sync endpoint (older release): fall back to merging the newest page. */
  | { kind: "unsupported"; state: ConversationSyncState };

/**
 * The sync loop. `fetchPage` returns null when the endpoint does not exist
 * (HTTP 404 from an older backend). `applyPage` is called once per page, in
 * order; if the loop stops part-way (a failed request throws), the state it
 * reached is consistent and a later sync continues from it, with no event
 * applied twice or skipped.
 */
export const runMessageSync = async (
  state: ConversationSyncState,
  fetchPage: (afterSeq: number, conversationId: EntityId | null) => Promise<MessageSyncResult | null>,
  applyPage: (page: MessageSyncResult) => void,
  maxPages = MESSAGE_SYNC_MAX_PAGES,
): Promise<SyncOutcome> => {
  let current = state;
  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const page = await fetchPage(current.cursor, current.conversationId);
    if (!page) return { kind: "unsupported", state: current };
    if (page.conversationGone) return { kind: "gone", state: { conversationId: null, cursor: 0 } };
    if (page.resyncRequired) return { kind: "resync", state: { conversationId: page.conversationId, cursor: 0 } };
    applyPage(page);
    current = { conversationId: page.conversationId ?? current.conversationId, cursor: page.nextAfterSeq };
    if (!page.hasMore) return { kind: "synced", state: current };
  }
  return { kind: "resync", state: current };
};
