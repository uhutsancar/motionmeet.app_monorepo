import type { Routine, Workout, WorkoutExercise } from "@motionmeet/shared";
import { database, type DatabaseTransaction } from "../configs/database.js";
import type { Row } from "../db/types.js";
import { numberValue, serializeExercise, toIsoString } from "./entities.js";

type Executor = DatabaseTransaction | typeof database;

interface ChildExerciseRow {
  id: string;
  parentId: string;
  exerciseId: string | null;
  position: number;
  exerciseName: string;
  muscleGroup: string;
  equipment: string;
}

interface ChildSetRow {
  id: string;
  childId: string;
  set_type: "normal" | "warmup" | "drop" | "failure";
  reps: number;
  weight: number | string;
  completed: boolean;
}

const loadExerciseChildren = async (kind: "routine" | "workout", parentIds: string[], executor: Executor): Promise<Map<string, WorkoutExercise[]>> => {
  const result = new Map<string, WorkoutExercise[]>();
  if (parentIds.length === 0) return result;
  const exerciseTable = kind === "routine" ? "routine_exercises" as const : "workout_exercises" as const;
  const parentColumn = kind === "routine" ? "routine_id" as const : "workout_id" as const;
  const childRows = await executor.selectFrom(exerciseTable).select([
    "id", `${parentColumn} as parentId`, "exercise_id as exerciseId", "position",
    "exercise_name as exerciseName", "muscle_group as muscleGroup", "equipment",
  ]).where(parentColumn, "in", parentIds).orderBy(parentColumn).orderBy("position").execute() as ChildExerciseRow[];
  const childIds = childRows.map((row) => row.id);
  const exerciseIds = [...new Set(childRows.map((row) => row.exerciseId).filter((id): id is string => Boolean(id)))];
  const setRows: ChildSetRow[] = childIds.length === 0 ? [] : kind === "routine"
    ? await executor.selectFrom("routine_sets").select(["id", "routine_exercise_id as childId", "set_type", "reps", "weight", "completed"])
      .where("routine_exercise_id", "in", childIds).orderBy("position").execute()
    : await executor.selectFrom("workout_sets").select(["id", "workout_exercise_id as childId", "set_type", "reps", "weight", "completed"])
      .where("workout_exercise_id", "in", childIds).orderBy("position").execute();
  const exerciseRows = exerciseIds.length ? await executor.selectFrom("exercises").selectAll().where("id", "in", exerciseIds).execute() : [];
  const exerciseById = new Map(exerciseRows.map((row) => [row.id, serializeExercise(row)]));
  for (const child of childRows) {
    const sets = setRows.filter((row) => row.childId === child.id).map((row) => ({
      id: row.id, setType: row.set_type, reps: row.reps, weight: numberValue(row.weight), completed: row.completed,
    }));
    const item: WorkoutExercise = {
      id: child.id,
      exerciseId: child.exerciseId ? exerciseById.get(child.exerciseId) ?? child.exerciseId : null,
      exerciseName: child.exerciseName,
      muscleGroup: child.muscleGroup,
      equipment: child.equipment,
      sets,
    };
    result.set(child.parentId, [...(result.get(child.parentId) ?? []), item]);
  }
  return result;
};

export const hydrateRoutines = async (rows: Array<Row<"routines">>, executor: Executor = database): Promise<Routine[]> => {
  const children = await loadExerciseChildren("routine", rows.map((row) => row.id), executor);
  return rows.map((row) => ({
    id: row.id, _id: row.id, userId: row.user_id, operationId: row.operation_id,
    name: row.name, folder: row.folder, exercises: children.get(row.id) ?? [],
    createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString(),
  }));
};

export const hydrateWorkouts = async (rows: Array<Row<"workouts">>, executor: Executor = database): Promise<Workout[]> => {
  const children = await loadExerciseChildren("workout", rows.map((row) => row.id), executor);
  return rows.map((row) => ({
    id: row.id, _id: row.id, userId: row.user_id, operationId: row.operation_id,
    name: row.name, startTime: toIsoString(row.start_time) ?? new Date(0).toISOString(),
    endTime: toIsoString(row.end_time), durationMinutes: row.duration_minutes,
    volumeKg: numberValue(row.volume_kg), totalSets: row.total_sets,
    totalReps: numberValue(row.total_reps), metricsVersion: row.metrics_version,
    exercises: children.get(row.id) ?? [],
    createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString(),
  }));
};

export const findRoutineById = async (id: string, executor: Executor = database): Promise<Routine | null> => {
  const row = await executor.selectFrom("routines").selectAll().where("id", "=", id).executeTakeFirst();
  return row ? (await hydrateRoutines([row], executor))[0] ?? null : null;
};

export const findWorkoutById = async (id: string, executor: Executor = database): Promise<Workout | null> => {
  const row = await executor.selectFrom("workouts").selectAll().where("id", "=", id).executeTakeFirst();
  return row ? (await hydrateWorkouts([row], executor))[0] ?? null : null;
};
