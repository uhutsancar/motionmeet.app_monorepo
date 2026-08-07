import type { EntityId, IdempotentRequest, Timestamped } from "./common.js";
import type { PublicUser } from "./user.js";
import type { Workout } from "./workout.js";

export type PostVisibility = "public" | "followers" | "private";
export type PostType = "text" | "image" | "text_with_image" | "video" | "workout";

export interface PostMedia {
  id: EntityId;
  url: string;
  mediaType: "image" | "video";
  position: number;
}

export interface Comment extends Timestamped {
  id: EntityId;
  _id: EntityId;
  postId?: EntityId;
  content: string;
  user: PublicUser | null;
}

export interface Like {
  postId: EntityId;
  userId: EntityId;
  createdAt: string;
}

export interface Post extends Timestamped, IdempotentRequest {
  id: EntityId;
  _id: EntityId;
  user: PublicUser | EntityId;
  content: string;
  image_urls: string[];
  media?: PostMedia[];
  post_type: PostType;
  visibility: PostVisibility;
  like_count: number;
  comment_count: number;
  share_count: number;
  download_count: number;
  workout: Workout | EntityId | null;
  liked_by_me?: boolean;
  author_followed_by_me?: boolean;
  /** A follow request to the author is waiting for approval. */
  author_follow_requested?: boolean;
  /** The author follows the viewer, so the card can offer "Follow back". */
  author_follows_me?: boolean;
  comments?: Comment[];
  comment_next_cursor?: string | null;
}

export type PostDetail = Post;

export interface SavedItem {
  userId: EntityId;
  entityId: EntityId;
  entityType: "post" | "exercise";
  createdAt: string;
}

export type Favorite = SavedItem;
