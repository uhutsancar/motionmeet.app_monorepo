import api from "~/api/axios";
import { API_ROUTES, type Conversation, type Message } from "@motionmeet/shared";

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
