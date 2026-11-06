import type { PostType } from "@motionmeet/shared";

/**
 * One file attached to a post, as the server verified it.
 *
 * `contentType` and `sizeBytes` come from object storage and the file's own
 * leading bytes (or, for the legacy multipart path, from the signature check
 * on the buffer) - never from the post request - so they are what gets stored
 * on the `post_media` row. `sizeBytes` is null only where nothing trustworthy
 * measured it.
 */
export interface PostMediaInput {
  url: string;
  key: string;
  contentType: string;
  sizeBytes: number | null;
}

export const mediaKindOf = (contentType: string): "image" | "video" =>
  contentType.toLowerCase().startsWith("video/") ? "video" : "image";

/**
 * The post type that is stored, decided by what was actually attached.
 *
 * The client's `post_type` is only validated, never trusted: the feed applies
 * `privacy_show_workouts_on_feed` to `workout` posts, so a workout attached
 * under any other declared type would slip past that setting, and a video
 * declared as `image` would be served to players that cannot handle it.
 */
export const resolvePostType = ({ hasText, hasWorkout, media }: {
  hasText: boolean;
  hasWorkout: boolean;
  media: readonly Pick<PostMediaInput, "contentType">[];
}): PostType => {
  if (hasWorkout) return "workout";
  if (media.some(({ contentType }) => mediaKindOf(contentType) === "video")) return "video";
  if (media.length) return hasText ? "text_with_image" : "image";
  return "text";
};
