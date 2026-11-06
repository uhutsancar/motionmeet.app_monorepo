import axios from "axios";
import api from "~/api/axios";
import { API_ROUTES, type Conversation, type Message, type MessageSyncResult } from "@motionmeet/shared";

export interface ConversationsResponse { success: boolean; conversations: Conversation[]; nextCursor: string | null }
export interface MessagesResponse { success: boolean; messages: Message[]; nextCursor: string | null }
interface BasicResponse { success: boolean; message?: string; messageId?: string }

export const getConversations = async (token: string, cursor?: string | null): Promise<ConversationsResponse> => {
  const { data } = await api.get<ConversationsResponse>(API_ROUTES.message.conversations, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const getMessages = async (token: string, toUserId: string, cursor?: string | null): Promise<MessagesResponse> => {
  const { data } = await api.post<MessagesResponse>(API_ROUTES.message.get,
    { to_user_id: toUserId },
    {
      headers: { Authorization: `Bearer ${token}` },
      params: cursor ? { cursor } : undefined,
    }
  );
  return data;
};

/**
 * One page of what changed in a conversation after `afterSeq` (ADR 005).
 * Resolves to null when the backend predates the endpoint (404), so the
 * caller can fall back to merging the newest page.
 */
export const syncMessages = async (token: string, toUserId: string, afterSeq: number, conversationId: string | null): Promise<MessageSyncResult | null> => {
  try {
    const { data } = await api.post<MessageSyncResult & { success: boolean }>(API_ROUTES.message.sync,
      { to_user_id: toUserId, afterSeq, conversationId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
};

export const markSeen = async (token: string, fromUserId: string): Promise<BasicResponse> => {
  const { data } = await api.post<BasicResponse>(API_ROUTES.message.seen,
    { from_user_id: fromUserId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
};

export const deleteMessage = async (token: string, messageId: string): Promise<BasicResponse> => {
  const { data } = await api.delete<BasicResponse>(API_ROUTES.message.delete(messageId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};
