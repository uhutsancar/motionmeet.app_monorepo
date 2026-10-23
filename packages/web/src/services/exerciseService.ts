import api from "~/api/axios";
import { API_ROUTES, type Exercise, type ExerciseStats, type PersonalRecord } from "@motionmeet/shared";

export interface ExerciseFilters { search?: string; muscleGroup?: string; equipment?: string; cursor?: string | null; limit?: number }
export interface ExercisesResponse { success: boolean; message?: string; exercises: Exercise[]; total: number | null; nextCursor: string | null; limit: number; skip: number }
/** The server nests the aggregates under `stats`; reading them from the top level showed 0 kg and 0 sessions for every movement. */
export interface ExerciseStatsResponse { success: boolean; stats?: ExerciseStats }
export interface PersonalRecordsResponse { success: boolean; records: PersonalRecord[] }

export const getExercises = async (
  token: string,
  { search, muscleGroup, equipment, cursor, limit = 50 }: ExerciseFilters,
): Promise<ExercisesResponse> => {
  const params: Record<string, string | number> = { limit };
  if (search) params.search = search;
  if (muscleGroup && muscleGroup !== "All Muscles") params.muscleGroup = muscleGroup;
  if (equipment && equipment !== "All Equipment") params.equipment = equipment;
  if (cursor) params.cursor = cursor;

  const { data } = await api.get<ExercisesResponse>(API_ROUTES.exercise.base, {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getExerciseStats = async (token: string, exerciseId: string): Promise<ExerciseStatsResponse> => {
  const { data } = await api.get<ExerciseStatsResponse>(API_ROUTES.exercise.stats(exerciseId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getPersonalRecords = async (token: string): Promise<PersonalRecordsResponse> => {
  const { data } = await api.get<PersonalRecordsResponse>(API_ROUTES.exercise.records, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};
