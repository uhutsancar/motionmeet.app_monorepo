import api from "~/api/axios";
import { API_ROUTES } from "@motionmeet/shared";

export const getConnections = async (token, section, cursor) => {
  const { data } = await api.get(API_ROUTES.user_extras.connections, {
    headers: { Authorization: `Bearer ${token}` },
    params: section
      ? { section, ...(cursor ? { cursor } : {}) }
      : undefined,
  });
  return data;
};
