import { database, withTransaction } from "../configs/database.js";
import { getCachedJson, invalidateCachePrefix, setCachedJson } from "../configs/redis.js";
import type { Row } from "../db/types.js";
import { serializeExercise, type InternalExercise } from "../repositories/entities.js";
import { getComputedExerciseStats, getComputedPersonalRecords } from "./workoutAnalyticsService.js";

interface ExerciseCursor { name: string; id: string }
export interface ExerciseListOptions {
  search?: unknown; muscleGroup?: unknown; equipment?: unknown; limitNum: number; skipNum: number;
  cursor?: ExerciseCursor | null; includeTotal?: boolean; userId: string;
}

const hydrateExercises = async (rows: Array<Row<"exercises">>): Promise<InternalExercise[]> => {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [muscles, instructions] = await Promise.all([
    database.selectFrom("exercise_secondary_muscles").selectAll().where("exercise_id", "in", ids).orderBy("position").execute(),
    database.selectFrom("exercise_instructions").selectAll().where("exercise_id", "in", ids).execute(),
  ]);
  return rows.map((row) => serializeExercise(row, muscles.filter((entry) => entry.exercise_id === row.id).map((entry) => entry.muscle), instructions.filter((entry) => entry.exercise_id === row.id)));
};

export const getExercisesList = async (options: ExerciseListOptions): Promise<{ exercises: InternalExercise[]; total: number | null; nextCursor: string | null }> => {
  const search = typeof options.search === "string" ? options.search.trim().toLocaleLowerCase("en-US") : "";
  const muscleGroup = typeof options.muscleGroup === "string" ? options.muscleGroup : "";
  const equipment = typeof options.equipment === "string" ? options.equipment : "";
  const cacheKey = `exercises:list:${options.userId}:${search}:${muscleGroup}:${equipment}:${options.limitNum}:${options.skipNum}:${options.cursor?.name ?? ""}:${options.cursor?.id ?? ""}:${Boolean(options.includeTotal)}`;
  const cached = await getCachedJson<{ exercises: InternalExercise[]; total: number | null; nextCursor: string | null }>(cacheKey);
  if (cached) return cached;
  let query = database.selectFrom("exercises").selectAll().where((expression) => expression.or([
    expression("is_custom", "=", false), expression.and([expression("is_custom", "=", true), expression("created_by", "=", options.userId)]),
  ]));
  if (search) query = query.where("name_normalized", "like", `${search}%`);
  if (muscleGroup && muscleGroup !== "All Muscles") query = query.where("muscle_group", "=", muscleGroup);
  if (equipment && equipment !== "All Equipment") query = query.where("equipment", "=", equipment);
  if (options.cursor) query = query.where((expression) => expression.or([
    expression("name_normalized", ">", options.cursor!.name),
    expression.and([expression("name_normalized", "=", options.cursor!.name), expression("id", ">", options.cursor!.id)]),
  ]));
  const rows = await query.orderBy("name_normalized").orderBy("id").offset(options.cursor ? 0 : options.skipNum).limit(options.limitNum + 1).execute();
  const hasMore = rows.length > options.limitNum;
  const selected = hasMore ? rows.slice(0, options.limitNum) : rows;
  const exercises = await hydrateExercises(selected);
  const last = selected.at(-1);
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ name: last.name_normalized, id: last.id })).toString("base64url") : null;
  let total: number | null = null;
  if (options.includeTotal) {
    let countQuery = database.selectFrom("exercises").select((expression) => expression.fn.countAll<number>().as("count")).where((expression) => expression.or([
      expression("is_custom", "=", false), expression.and([expression("is_custom", "=", true), expression("created_by", "=", options.userId)]),
    ]));
    if (search) countQuery = countQuery.where("name_normalized", "like", `${search}%`);
    if (muscleGroup && muscleGroup !== "All Muscles") countQuery = countQuery.where("muscle_group", "=", muscleGroup);
    if (equipment && equipment !== "All Equipment") countQuery = countQuery.where("equipment", "=", equipment);
    total = Number((await countQuery.executeTakeFirst())?.count ?? 0);
  }
  const result = { exercises, total, nextCursor };
  await setCachedJson(cacheKey, result, 300);
  return result;
};

export const getExerciseById = async (id: string, userId: string): Promise<InternalExercise | null> => {
  const cacheKey = `exercises:detail:${userId}:${id}`;
  const cached = await getCachedJson<InternalExercise>(cacheKey);
  if (cached) return cached;
  const row = await database.selectFrom("exercises").selectAll().where("id", "=", id).where((expression) => expression.or([
    expression("is_custom", "=", false), expression("created_by", "=", userId),
  ])).executeTakeFirst();
  if (!row) return null;
  const [exercise] = await hydrateExercises([row]);
  if (exercise) await setCachedJson(cacheKey, exercise, 900);
  return exercise ?? null;
};

interface NewExerciseInput { name: string; muscleGroup?: unknown; equipment?: unknown; target?: unknown; category?: unknown; secondary_muscles?: unknown; imageUrl?: unknown; gifUrl?: unknown; userId: string }
export const createExercise = async (input: NewExerciseInput): Promise<InternalExercise> => {
  const secondary = Array.isArray(input.secondary_muscles) ? input.secondary_muscles.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()) : [];
  const row = await withTransaction(async (transaction) => {
    const created = await transaction.insertInto("exercises").values({
      legacy_mongo_id: null, external_id: null, name: input.name.trim(), name_normalized: input.name.trim().toLocaleLowerCase("en-US"),
      muscle_group: typeof input.muscleGroup === "string" ? input.muscleGroup.trim() : "Other",
      equipment: typeof input.equipment === "string" ? input.equipment.trim() : "Body Weight",
      target: typeof input.target === "string" ? input.target.trim() : "", category: typeof input.category === "string" ? input.category.trim() : "",
      image_url: typeof input.imageUrl === "string" ? input.imageUrl.trim() : "", image_key: "",
      gif_url: typeof input.gifUrl === "string" ? input.gifUrl.trim() : "", gif_key: "", is_custom: true, created_by: input.userId,
    }).returningAll().executeTakeFirstOrThrow();
    for (const [position, muscle] of secondary.entries()) await transaction.insertInto("exercise_secondary_muscles").values({ exercise_id: created.id, muscle, position }).execute();
    return created;
  });
  await invalidateCachePrefix("exercises:list:");
  return serializeExercise(row, secondary);
};

interface ExerciseReference { exerciseId: string; exerciseName?: string; muscleGroup?: string; equipment?: string; sets?: Array<{ setType?: "normal" | "warmup" | "drop" | "failure"; reps?: number; weight?: number; completed?: boolean }> }
export const validateExerciseReferences = async (exercises: ExerciseReference[], userId: string): Promise<boolean> => {
  const ids = [...new Set(exercises.map((exercise) => exercise.exerciseId))];
  if (!ids.length) return false;
  const result = await database.selectFrom("exercises").select((expression) => expression.fn.countAll<number>().as("count")).where("id", "in", ids)
    .where((expression) => expression.or([expression("is_custom", "=", false), expression("created_by", "=", userId)])).executeTakeFirst();
  return Number(result?.count ?? 0) === ids.length;
};

export const addExerciseSnapshots = async <T extends ExerciseReference>(exercises: T[], userId: string): Promise<Array<T & { exerciseName: string; muscleGroup: string; equipment: string }>> => {
  const ids = [...new Set(exercises.map((exercise) => exercise.exerciseId))];
  const rows = ids.length ? await database.selectFrom("exercises").select(["id", "name", "muscle_group", "equipment"]).where("id", "in", ids)
    .where((expression) => expression.or([expression("is_custom", "=", false), expression("created_by", "=", userId)])).execute() : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  return exercises.map((exercise) => {
    const row = byId.get(exercise.exerciseId);
    if (!row) throw Object.assign(new Error("Exercise is no longer available"), { status: 409 });
    return { ...exercise, exerciseName: row.name, muscleGroup: row.muscle_group, equipment: row.equipment };
  });
};

export const getExerciseStatsLegacy = getComputedExerciseStats;
export const getPersonalRecordsLegacy = getComputedPersonalRecords;
export const getExerciseStats = getComputedExerciseStats;
export const getPersonalRecords = getComputedPersonalRecords;
