import type { ExerciseSet } from '@motionmeet/shared';

export interface ActiveWorkoutSet {
  reps: string;
  weight: string;
  done: boolean;
  setType: ExerciseSet['setType'];
}

export interface ActiveWorkoutExercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  imageUrl?: string;
  sets: ActiveWorkoutSet[];
}

export interface CompletedWorkoutExercise {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  imageUrl?: string;
  sets: ExerciseSet[];
}

export interface WorkoutSummaryData {
  name: string;
  note: string;
  duration: number;
  totalVolume: number;
  totalSets: number;
  exercises: CompletedWorkoutExercise[];
}
