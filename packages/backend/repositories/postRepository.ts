import type { Post, PostMedia, PublicUser } from "@motionmeet/shared";
import { database, type DatabaseTransaction } from "../configs/database.js";
import type { Row } from "../db/types.js";
import { hydrateWorkouts } from "./workoutRepository.js";
import { toIsoString } from "./entities.js";

type Executor = DatabaseTransaction | typeof database;

export const publicUser = (id: string, fullName: string, username: string, picture: string): PublicUser => ({ id, _id: id, full_name: fullName, username, profile_picture: picture });

export const hydratePosts = async (rows: Array<Row<"posts">>, executor: Executor = database): Promise<Post[]> => {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const workoutIds = [...new Set(rows.map((row) => row.workout_id).filter((id): id is string => Boolean(id)))];
  const [mediaRows, workoutRows] = await Promise.all([
    executor.selectFrom("post_media").selectAll().where("post_id", "in", ids).orderBy("position").execute(),
    workoutIds.length ? executor.selectFrom("workouts").selectAll().where("id", "in", workoutIds).execute() : [],
  ]);
  const workouts = await hydrateWorkouts(workoutRows, executor);
  const workoutById = new Map(workouts.map((workout) => [workout.id, workout]));
  return rows.map((row) => {
    const mediaForPost = mediaRows.filter((media) => media.post_id === row.id);
    const media: PostMedia[] = mediaForPost.map((entry) => ({ id: entry.id, url: entry.url, mediaType: entry.media_type, position: entry.position }));
    return {
      id: row.id, _id: row.id, operationId: row.operation_id,
      user: publicUser(row.user_id, row.author_full_name, row.author_username, row.author_profile_picture),
      content: row.content, image_urls: mediaForPost.map((entry) => entry.url), media,
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
