import type { EntityId, Timestamped } from "./common.js";

export interface ExerciseMedia {
  imageUrl: string;
  gifUrl: string;
}

export interface Exercise extends Timestamped, ExerciseMedia {
  id: EntityId;
  _id: EntityId;
  externalId: string | null;
  name: string;
  muscleGroup: string;
  target: string;
  category: string;
  secondary_muscles: string[];
  equipment: string;
  instructions: Record<string, string>;
  instructionSteps: Record<string, string[]>;
  isCustom: boolean;
  createdBy: EntityId | null;
}

export type ExerciseDetail = Exercise;

export interface ExerciseCategory {
  code: string;
  name: string;
}

export interface ExerciseSet {
  id?: EntityId;
  setType: "normal" | "warmup" | "drop" | "failure";
  reps: number;
  weight: number;
  completed: boolean;
}

export interface WorkoutExercise {
  id?: EntityId;
  exerciseId: EntityId | Exercise | null;
  exerciseName: string;
  muscleGroup: string;
  equipment: string;
  sets: ExerciseSet[];
}

export interface ExerciseStats {
  personalRecord: number;
  totalSessions: number;
  history: Array<{ date: string; maxWeight: number; volume: number }>;
}

export interface PersonalRecord {
  exerciseId: EntityId;
  name: string;
  value: number;
  reps: number;
  recordedAt: string;
}
