import type { EntityId, IdempotentRequest, Timestamped } from "./common.js";
import type { WorkoutExercise } from "./exercise.js";

export interface Workout extends Timestamped, IdempotentRequest {
  id: EntityId;
  _id: EntityId;
  userId: EntityId;
  name: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  volumeKg: number;
  totalSets: number;
  totalReps: number;
  metricsVersion: number;
  exercises: WorkoutExercise[];
}

export interface Routine extends Timestamped, IdempotentRequest {
  id: EntityId;
  _id: EntityId;
  userId: EntityId;
  name: string;
  folder: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutStats {
  stats: {
    labels: string[];
    dates: string[];
    volumes: number[];
    durations: number[];
    reps: number[];
    sets: number[];
    workouts: number[];
  };
  exerciseBreakdown: Array<{
    name: string;
    /** The exercise this row is for, so its artwork can be shown beside it. */
    exerciseId?: string;
    imageUrl?: string;
    gifUrl?: string;
    volume: number;
    reps: number;
    sets: number;
    total: number;
  }>;
  muscleDistribution: Record<string, number>;
  /** Completed sets per muscle group over the period, keyed like `muscleDistribution`. */
  muscleSets?: Record<string, number>;
  /** The same counts for the window just before the period (absent for the 12-week series). */
  previousMuscleSets?: Record<string, number>;
  totalVolume: number;
  totalDuration: number;
  totalWorkouts: number;
  totalSets: number;
  workoutDates: string[];
  currentStreakDays: number;
}
