import api from "~/api/axios";
import { API_ROUTES, type PublicUser } from "@motionmeet/shared";

export type RelationshipSection = "connections" | "pendingConnections" | "followers" | "following";
export interface ConnectionsResponse {
  success: boolean;
  connections: PublicUser[];
  pendingConnections: PublicUser[];
  followers: PublicUser[];
  following: PublicUser[];
  items?: PublicUser[];
  nextCursor?: string | null;
}

export const getConnections = async (token: string, section?: RelationshipSection | null, cursor?: string | null): Promise<ConnectionsResponse> => {
  const { data } = await api.get<ConnectionsResponse>(API_ROUTES.user_extras.connections, {
    headers: { Authorization: `Bearer ${token}` },
    params: section
      ? { section, ...(cursor ? { cursor } : {}) }
      : undefined,
  });
  return data;
};
