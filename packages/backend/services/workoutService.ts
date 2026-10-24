import type { Workout } from "@motionmeet/shared";
import { database, withTransaction, type DatabaseTransaction } from "../configs/database.js";
import { findWorkoutById, hydrateWorkouts } from "../repositories/workoutRepository.js";
import type { Pagination } from "../utils/pagination.js";
import * as quotaService from "./quotaService.js";
import { applyWorkoutAnalytics, getComputedWorkoutStats } from "./workoutAnalyticsService.js";

interface WorkoutSetInput { setType?: "normal" | "warmup" | "drop" | "failure"; reps: number; weight: number; completed: boolean }
interface WorkoutExerciseInput { exerciseId: string; exerciseName: string; muscleGroup: string; equipment: string; sets: WorkoutSetInput[] }
export interface WorkoutInput {
  userId: string; operationId: string; name: string; startTime: Date | string; endTime: Date | string;
  durationMinutes: number; volumeKg: number; totalSets: number; totalReps: number; metricsVersion: number; exercises: WorkoutExerciseInput[];
}

export const countUserWorkoutsFromDate = async (userId: string, startDate: Date, transaction: DatabaseTransaction | typeof database = database): Promise<number> =>
  Number((await transaction.selectFrom("workouts").select((expression) => expression.fn.countAll<number>().as("count")).where("user_id", "=", userId).where("created_at", ">=", startDate).executeTakeFirst())?.count ?? 0);

/**
 * Two statements whatever the size of the session: one for the exercises,
 * one for every set. Row-by-row inserts cost a round trip per set inside the
 * transaction - sixty for a ten-exercise, five-set workout. The returned ids
 * are matched by position, not by row order, which SQL does not promise.
 */
const insertWorkoutExercises = async (workoutId: string, exercises: WorkoutExerciseInput[], transaction: DatabaseTransaction): Promise<void> => {
  if (!exercises.length) return;
  const children = await transaction.insertInto("workout_exercises").values(exercises.map((exercise, position) => ({
    legacy_mongo_id: null, workout_id: workoutId, exercise_id: exercise.exerciseId, position,
    exercise_name: exercise.exerciseName, muscle_group: exercise.muscleGroup, equipment: exercise.equipment,
  }))).returning(["id", "position"]).execute();
  const idByPosition = new Map(children.map((child) => [child.position, child.id]));
  const sets = exercises.flatMap((exercise, position) => exercise.sets.map((set, setPosition) => ({
    legacy_mongo_id: null, workout_exercise_id: idByPosition.get(position)!, position: setPosition, set_type: set.setType ?? "normal",
    reps: set.reps, weight: set.weight, completed: set.completed,
  })));
  if (sets.length) await transaction.insertInto("workout_sets").values(sets).execute();
};

const uniqueViolation = (error: unknown): boolean => Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");

export const createWorkoutWithStatistics = async (input: WorkoutInput, { quotaLimit = -1 }: { quotaLimit?: number } = {}): Promise<Workout> => {
  try {
    return await withTransaction(async (transaction) => {
      const existing = await transaction.selectFrom("workouts").select("id").where("user_id", "=", input.userId).where("operation_id", "=", input.operationId).executeTakeFirst();
      if (existing) {
        const workout = await findWorkoutById(existing.id, transaction);
        if (!workout) throw new Error("Idempotent workout record is inconsistent");
        return workout;
      }
      if (quotaLimit !== -1) {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const reserved = await quotaService.reserveQuota({ userId: input.userId, bucket: quotaService.workoutBucket(now), limit: quotaLimit, getCurrentCount: () => countUserWorkoutsFromDate(input.userId, start, transaction), transaction, expiresAt: quotaService.monthlyUsageExpiry(now) });
        if (!reserved) throw Object.assign(new Error(`Monthly workout limit reached (${quotaLimit})`), { status: 403 });
      }
      const row = await transaction.insertInto("workouts").values({
        legacy_mongo_id: null, user_id: input.userId, operation_id: input.operationId, name: input.name,
        start_time: new Date(input.startTime), end_time: new Date(input.endTime), duration_minutes: input.durationMinutes,
        volume_kg: input.volumeKg, total_sets: input.totalSets, total_reps: input.totalReps, metrics_version: input.metricsVersion,
      }).returningAll().executeTakeFirstOrThrow();
      await insertWorkoutExercises(row.id, input.exercises, transaction);
      const workout = await findWorkoutById(row.id, transaction);
      if (!workout) throw new Error("Created workout could not be loaded");
      await applyWorkoutAnalytics(workout, { transaction });
      const updated = await transaction.updateTable("users").set((expression) => ({
        total_workouts: expression("total_workouts", "+", 1),
        total_duration_minutes: expression("total_duration_minutes", "+", input.durationMinutes),
        total_volume_kg: expression("total_volume_kg", "+", input.volumeKg),
      })).where("id", "=", input.userId).executeTakeFirst();
      if (Number(updated.numUpdatedRows) !== 1) throw new Error("Workout owner no longer exists");
      return workout;
    });
  } catch (error: unknown) {
    if (!uniqueViolation(error)) throw error;
    const existing = await database.selectFrom("workouts").select("id").where("user_id", "=", input.userId).where("operation_id", "=", input.operationId).executeTakeFirst();
    const workout = existing ? await findWorkoutById(existing.id) : null;
    if (!workout) throw error;
    return workout;
  }
};

export const getUserWorkoutsList = async (userId: string, pagination: Pagination): Promise<{ items: Workout[]; nextCursor: string | null }> => {
  let query = database.selectFrom("workouts").selectAll().where("user_id", "=", userId);
  if (pagination.cursor) query = query.where((expression) => expression.or([
    expression("start_time", "<", pagination.cursor!.date),
    expression.and([expression("start_time", "=", pagination.cursor!.date), expression("id", "<", pagination.cursor!.id)]),
  ]));
  const rows = await query.orderBy("start_time", "desc").orderBy("id", "desc").limit(pagination.limit + 1).execute();
  const hasMore = rows.length > pagination.limit;
  const selected = hasMore ? rows.slice(0, pagination.limit) : rows;
  const items = await hydrateWorkouts(selected);
  const last = selected.at(-1);
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ date: new Date(last.start_time).toISOString(), id: last.id })).toString("base64url") : null;
  return { items, nextCursor };
};
export const getWorkoutStatsData = getComputedWorkoutStats;
