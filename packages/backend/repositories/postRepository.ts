import { MEDIA_WIDTHS, type Post, type PostMedia, type PublicUser } from "@motionmeet/shared";
import { database, type DatabaseTransaction } from "../configs/database.js";
import type { Row } from "../db/types.js";
import { hydrateWorkouts } from "./workoutRepository.js";
import { toIsoString } from "./entities.js";
import { deliverMedia, profileImageUrl } from "../services/mediaDelivery.js";

type Executor = DatabaseTransaction | typeof database;

/** Every member card in every response goes through here, so the avatar is always delivered signed. */
export const publicUser = (id: string, fullName: string, username: string, picture: string): PublicUser => ({ id, _id: id, full_name: fullName, username, profile_picture: profileImageUrl(picture) });

export const hydratePosts = async (rows: Array<Row<"posts">>, executor: Executor = database): Promise<Post[]> => {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const workoutIds = [...new Set(rows.map((row) => row.workout_id).filter((id): id is string => Boolean(id)))];
  const authorIds = [...new Set(rows.map((row) => row.user_id))];
  // The author's name and picture are read live - a primary-key lookup per
  // author on the page, in parallel with the media. Posts still carry a copy
  // (`author_*`), now only a fallback: keeping that copy current is what made
  // every profile edit rewrite all of the author's posts before it showed.
  const [mediaRows, workoutRows, authorRows] = await Promise.all([
    executor.selectFrom("post_media").selectAll().where("post_id", "in", ids).orderBy("position").execute(),
    workoutIds.length ? executor.selectFrom("workouts").selectAll().where("id", "in", workoutIds).execute() : [],
    executor.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url"]).where("id", "in", authorIds).execute(),
  ]);
  const authorById = new Map(authorRows.map((author) => [author.id, author]));
  const workouts = await hydrateWorkouts(workoutRows, executor);
  const workoutById = new Map(workouts.map((workout) => [workout.id, workout]));
  return rows.map((row) => {
    const mediaForPost = mediaRows.filter((media) => media.post_id === row.id);
    // The stored URL is only a record; what the viewer gets is signed for this
    // window from the object key (services/mediaDelivery.ts).
    //
    // A signed URL cannot be resized by the client any more (the width is part
    // of what is signed), so images also carry signed variants at the widths
    // the apps display them at.
    const media: PostMedia[] = mediaForPost.map((entry) => {
      const source = { purpose: "posts" as const, key: entry.object_key, storedUrl: entry.url, contentType: entry.mime_type || entry.media_type };
      const delivered = deliverMedia(source);
      const variants = delivered.url && entry.media_type === "image" && delivered.url !== entry.url
        ? { variants: { thumb: deliverMedia({ ...source, width: MEDIA_WIDTHS.thumb }).url ?? delivered.url, feed: deliverMedia({ ...source, width: MEDIA_WIDTHS.feed }).url ?? delivered.url, detail: deliverMedia({ ...source, width: MEDIA_WIDTHS.detail }).url ?? delivered.url } }
        : {};
      return { id: entry.id, url: delivered.url, ...(delivered.unavailable ? { unavailable: true } : {}), ...variants, mediaType: entry.media_type, position: entry.position, width: entry.width, height: entry.height, durationSeconds: entry.duration_seconds === null ? null : Number(entry.duration_seconds) };
    });
    return {
      id: row.id, _id: row.id, operationId: row.operation_id,
      user: (() => {
        const author = authorById.get(row.user_id);
        return author
          ? publicUser(row.user_id, author.full_name, author.username, author.profile_picture_url)
          : publicUser(row.user_id, row.author_full_name, row.author_username, row.author_profile_picture);
      })(),
      content: row.content, image_urls: media.flatMap((entry) => entry.url ? [entry.url] : []), media,
      post_type: row.post_type, visibility: row.visibility, like_count: row.like_count, comment_count: row.comment_count,
      share_count: row.share_count, download_count: row.download_count,
      workout: row.workout_id ? workoutById.get(row.workout_id) ?? row.workout_id : null,
      createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(), updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString(),
    };
  });
};

export interface PostAccessRecord { id: string; _id: string; user: string; visibility: Row<"posts">["visibility"]; image_urls: string[]; image_keys: string[] }
export const findPostAccessRecord = async (postId: string, includeMedia = false, executor: Executor = database): Promise<PostAccessRecord | null> => {
  const row = await executor.selectFrom("posts").select(["id", "user_id", "visibility"]).where("id", "=", postId).executeTakeFirst();
  if (!row) return null;
  const media = includeMedia ? await executor.selectFrom("post_media").select(["url", "object_key"]).where("post_id", "=", postId).orderBy("position").execute() : [];
  return { id: row.id, _id: row.id, user: row.user_id, visibility: row.visibility, image_urls: media.map((entry) => entry.url), image_keys: media.map((entry) => entry.object_key) };
};

export const findHydratedPost = async (postId: string, executor: Executor = database): Promise<Post | null> => {
  const row = await executor.selectFrom("posts").selectAll().where("id", "=", postId).executeTakeFirst();
  return row ? (await hydratePosts([row], executor))[0] ?? null : null;
};
