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
    volume: number;
    reps: number;
    sets: number;
    total: number;
  }>;
  muscleDistribution: Record<string, number>;
  totalVolume: number;
  totalDuration: number;
  totalWorkouts: number;
  totalSets: number;
  workoutDates: string[];
  currentStreakDays: number;
}
