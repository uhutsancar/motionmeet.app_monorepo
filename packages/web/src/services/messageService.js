import api from "~/api/axios";
import { API_ROUTES } from "@motionmeet/shared";

export const getConversations = async (token, cursor) => {
  const { data } = await api.get(API_ROUTES.message.conversations, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const getMessages = async (token, toUserId, cursor) => {
  const { data } = await api.post(API_ROUTES.message.get,
    { to_user_id: toUserId },
    {
      headers: { Authorization: `Bearer ${token}` },
      params: cursor ? { cursor } : undefined,
    }
  );
  return data;
};

export const markSeen = async (token, fromUserId) => {
  const { data } = await api.post(API_ROUTES.message.seen,
    { from_user_id: fromUserId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
};

export const deleteMessage = async (token, messageId) => {
  const { data } = await api.delete(API_ROUTES.message.delete(messageId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};
