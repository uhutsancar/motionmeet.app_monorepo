import type { Routine } from "@motionmeet/shared";
import { database, withTransaction, type DatabaseTransaction } from "../configs/database.js";
import { findRoutineById, hydrateRoutines } from "../repositories/workoutRepository.js";
import type { Pagination } from "../utils/pagination.js";
import * as quotaService from "./quotaService.js";

interface SetInput { setType?: "normal" | "warmup" | "drop" | "failure"; reps?: number; weight?: number; completed?: boolean }
interface ExerciseInput { exerciseId: string; exerciseName: string; muscleGroup: string; equipment: string; sets?: SetInput[] }
interface RoutineInput { userId: string; operationId: string; name: string; folder: string; exercises: ExerciseInput[] }
interface RoutineUpdate { name?: string; folder?: string; exercises?: ExerciseInput[] }

/**
 * Two statements whatever the size of the routine: one for the exercises, one
 * for every set (MM-PERF-04 in the 2026-11 audit). The loop this replaced made
 * a round trip per exercise and per set inside the transaction - sixty for a
 * ten-exercise, five-set routine. Same shape as `insertWorkoutExercises`; the
 * returned ids are matched by position, not by row order, which SQL does not
 * promise.
 */
const insertExercises = async (routineId: string, exercises: ExerciseInput[], transaction: DatabaseTransaction): Promise<void> => {
  if (!exercises.length) return;
  const children = await transaction.insertInto("routine_exercises").values(exercises.map((exercise, position) => ({
    legacy_mongo_id: null, routine_id: routineId, exercise_id: exercise.exerciseId, position,
    exercise_name: exercise.exerciseName, muscle_group: exercise.muscleGroup, equipment: exercise.equipment,
  }))).returning(["id", "position"]).execute();
  const idByPosition = new Map(children.map((child) => [child.position, child.id]));
  const sets = exercises.flatMap((exercise, position) => (exercise.sets ?? []).map((set, setPosition) => ({
    legacy_mongo_id: null, routine_exercise_id: idByPosition.get(position)!, position: setPosition,
    set_type: set.setType ?? "normal" as const, reps: set.reps ?? 0, weight: set.weight ?? 0, completed: set.completed ?? false,
  })));
  if (sets.length) await transaction.insertInto("routine_sets").values(sets).execute();
};

export const getUserRoutinesList = async (userId: string, pagination: Pagination): Promise<{ items: Routine[]; nextCursor: string | null }> => {
  let query = database.selectFrom("routines").selectAll().where("user_id", "=", userId);
  if (pagination.cursor) query = query.where((expression) => expression.or([
    expression("updated_at", "<", pagination.cursor!.date),
    expression.and([expression("updated_at", "=", pagination.cursor!.date), expression("id", "<", pagination.cursor!.id)]),
  ]));
  const rows = await query.orderBy("updated_at", "desc").orderBy("id", "desc").limit(pagination.limit + 1).execute();
  const hasMore = rows.length > pagination.limit;
  const selected = hasMore ? rows.slice(0, pagination.limit) : rows;
  const items = await hydrateRoutines(selected);
  const last = selected.at(-1);
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ date: new Date(last.updated_at).toISOString(), id: last.id })).toString("base64url") : null;
  return { items, nextCursor };
};

export const countUserRoutines = async (userId: string, transaction: DatabaseTransaction | typeof database = database): Promise<number> =>
  Number((await transaction.selectFrom("routines").select((expression) => expression.fn.countAll<number>().as("count")).where("user_id", "=", userId).executeTakeFirst())?.count ?? 0);

export const createRoutine = async (input: RoutineInput, { quotaLimit = -1 }: { quotaLimit?: number } = {}): Promise<Routine> => {
  try {
    return await withTransaction(async (transaction) => {
      const existing = await transaction.selectFrom("routines").select("id").where("user_id", "=", input.userId).where("operation_id", "=", input.operationId).executeTakeFirst();
      if (existing) {
        const routine = await findRoutineById(existing.id, transaction);
        if (!routine) throw new Error("Idempotent routine record is inconsistent");
        return routine;
      }
      if (quotaLimit !== -1) {
        const reserved = await quotaService.reserveQuota({ userId: input.userId, bucket: quotaService.routineBucket, limit: quotaLimit, getCurrentCount: () => countUserRoutines(input.userId, transaction), transaction });
        if (!reserved) throw Object.assign(new Error(`Routine limit reached (${quotaLimit})`), { status: 403 });
      }
      const row = await transaction.insertInto("routines").values({ legacy_mongo_id: null, user_id: input.userId, operation_id: input.operationId, name: input.name, folder: input.folder }).returningAll().executeTakeFirstOrThrow();
      await insertExercises(row.id, input.exercises, transaction);
      const routine = await findRoutineById(row.id, transaction);
      if (!routine) throw new Error("Created routine could not be loaded");
      return routine;
    });
  } catch (error: unknown) {
    const unique = Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
    if (!unique) throw error;
    const existing = await database.selectFrom("routines").select("id").where("user_id", "=", input.userId).where("operation_id", "=", input.operationId).executeTakeFirst();
    const routine = existing ? await findRoutineById(existing.id) : null;
    if (!routine) throw error;
    return routine;
  }
};

export const updateRoutine = async (id: string, userId: string, update: RoutineUpdate): Promise<Routine | null> => withTransaction(async (transaction) => {
  const current = await transaction.selectFrom("routines").select("id").where("id", "=", id).where("user_id", "=", userId).forUpdate().executeTakeFirst();
  if (!current) return null;
  if (update.name !== undefined || update.folder !== undefined) await transaction.updateTable("routines").set({ ...(update.name !== undefined ? { name: update.name } : {}), ...(update.folder !== undefined ? { folder: update.folder } : {}) }).where("id", "=", id).execute();
  if (update.exercises) {
    await transaction.deleteFrom("routine_exercises").where("routine_id", "=", id).execute();
    await insertExercises(id, update.exercises, transaction);
  }
  return findRoutineById(id, transaction);
});

export const deleteRoutine = async (id: string, userId: string): Promise<Routine | null> => withTransaction(async (transaction) => {
  const routine = await findRoutineById(id, transaction);
  if (!routine || routine.userId !== userId) return null;
  await transaction.deleteFrom("routines").where("id", "=", id).where("user_id", "=", userId).execute();
  await quotaService.releaseQuota(userId, quotaService.routineBucket, transaction);
  return routine;
});
