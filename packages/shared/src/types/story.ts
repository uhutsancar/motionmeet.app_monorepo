import type { EntityId, IdempotentRequest, Timestamped } from "./common.js";
import type { PublicUser } from "./user.js";

export interface Story extends Timestamped, IdempotentRequest {
  id: EntityId;
  _id: EntityId;
  user: PublicUser | EntityId;
  content: string;
  media_url: string;
  media_type: "text" | "image" | "video";
  background_color: string;
  expiresAt: string;
}
