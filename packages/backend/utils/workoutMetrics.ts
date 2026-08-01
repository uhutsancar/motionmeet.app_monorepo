import type { ExerciseSet, WorkoutExercise } from "@motionmeet/shared";

const MAX_DURATION_MINUTES = 10_080;
const SET_TYPES = new Set<ExerciseSet["setType"]>(["normal", "warmup", "drop", "failure"]);
const toFiniteNumber = (value: unknown): number => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const roundMetric = (value: number): number => Math.round(value * 100) / 100;

interface RawExerciseReference { _id?: unknown; id?: unknown; name?: unknown; muscleGroup?: unknown; equipment?: unknown }
interface RawSet { setType?: unknown; reps?: unknown; weight?: unknown; completed?: unknown }
export interface RawWorkoutExercise { exerciseId?: unknown; exerciseName?: unknown; muscleGroup?: unknown; equipment?: unknown; sets?: unknown }
export interface NormalizedExercise extends Omit<WorkoutExercise, "exerciseId"> { exerciseId: string }

const stringValue = (value: unknown): string => typeof value === "string" ? value : "";
const reference = (value: unknown): RawExerciseReference => value && typeof value === "object" ? value as RawExerciseReference : {};

export const normalizeCompletedExercises = (exercises: unknown, { treatAllAsCompleted = false }: { treatAllAsCompleted?: boolean } = {}): NormalizedExercise[] =>
  (Array.isArray(exercises) ? exercises : []).map((candidate: unknown) => {
    const exercise = candidate && typeof candidate === "object" ? candidate as RawWorkoutExercise : {};
    const document = reference(exercise.exerciseId);
    const exerciseId = stringValue(document.id ?? document._id ?? exercise.exerciseId);
    const sets: ExerciseSet[] = (Array.isArray(exercise.sets) ? exercise.sets : []).filter((setCandidate: unknown) => {
      const set = setCandidate && typeof setCandidate === "object" ? setCandidate as RawSet : {};
      return treatAllAsCompleted || set.completed !== false;
    }).map((setCandidate: unknown) => {
      const set = setCandidate as RawSet;
      const setType = typeof set.setType === "string" && SET_TYPES.has(set.setType as ExerciseSet["setType"]) ? set.setType as ExerciseSet["setType"] : "normal";
      return { setType, reps: toFiniteNumber(set.reps), weight: toFiniteNumber(set.weight), completed: true };
    });
    return { exerciseId, exerciseName: stringValue(exercise.exerciseName) || stringValue(document.name), muscleGroup: stringValue(exercise.muscleGroup) || stringValue(document.muscleGroup), equipment: stringValue(exercise.equipment) || stringValue(document.equipment), sets };
  }).filter((exercise) => Boolean(exercise.exerciseId) && exercise.sets.length > 0);

export const calculateWorkoutMetrics = ({ startTime, endTime, exercises, fallbackDurationMinutes = 0 }: { startTime: Date | string; endTime: Date | string; exercises: NormalizedExercise[]; fallbackDurationMinutes?: unknown }) => {
  const start = new Date(startTime); const end = new Date(endTime);
  const valid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start;
  const durationMinutes = Math.min(MAX_DURATION_MINUTES, Math.max(0, valid ? Math.round((end.getTime() - start.getTime()) / 60_000) : Math.round(toFiniteNumber(fallbackDurationMinutes))));
  let volumeKg = 0; let totalSets = 0; let totalReps = 0;
  for (const exercise of exercises) for (const set of exercise.sets) {
    if (set.completed === false) continue;
    const reps = Math.max(0, toFiniteNumber(set.reps)); const weight = Math.max(0, toFiniteNumber(set.weight));
    totalSets += 1; totalReps += reps; volumeKg += weight * reps;
  }
  return { durationMinutes, volumeKg: roundMetric(volumeKg), totalSets, totalReps: roundMetric(totalReps) };
};

export interface CanonicalWorkoutInput { userId: string; operationId: string; name: string; startTime: Date | string; endTime: Date | string; exercises: unknown; durationMinutes?: unknown }
export const buildCanonicalWorkout = (workoutData: CanonicalWorkoutInput, options: { treatAllAsCompleted?: boolean } = {}) => {
  const exercises = normalizeCompletedExercises(workoutData.exercises, options);
  return { ...workoutData, exercises, ...calculateWorkoutMetrics({ startTime: workoutData.startTime, endTime: workoutData.endTime, exercises, fallbackDurationMinutes: workoutData.durationMinutes }), metricsVersion: 2 };
};

export const calculateCurrentStreak = (dateKeys: Iterable<string>, now = new Date()): number => {
  const availableDates = new Set(dateKeys); const cursor = new Date(now); cursor.setUTCHours(0, 0, 0, 0);
  const key = (date: Date): string => date.toISOString().slice(0, 10);
  if (!availableDates.has(key(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (availableDates.has(key(cursor))) { streak += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return streak;
};
