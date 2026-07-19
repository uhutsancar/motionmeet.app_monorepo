import api from "~/api/axios";

export const getConnections = async (token) => {
  const { data } = await api.get('/api/user/connections', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};
