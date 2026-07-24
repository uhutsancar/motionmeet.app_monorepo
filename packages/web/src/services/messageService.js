import api from "~/api/axios";

export const getConversations = async (token) => {
  const { data } = await api.get('/api/message/conversations', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getMessages = async (token, toUserId, cursor) => {
  const { data } = await api.post('/api/message/get', 
    { to_user_id: toUserId },
    {
      headers: { Authorization: `Bearer ${token}` },
      params: cursor ? { cursor } : undefined,
    }
  );
  return data;
};

export const markSeen = async (token, fromUserId) => {
  const { data } = await api.post('/api/message/seen', 
    { from_user_id: fromUserId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
};

export const deleteMessage = async (token, messageId) => {
  const { data } = await api.delete(`/api/message/delete/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};
