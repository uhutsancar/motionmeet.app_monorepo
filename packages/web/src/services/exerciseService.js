import api from "~/api/axios";
import { API_ROUTES } from "@motionmeet/shared";

export const getExercises = async (
  token,
  { search, muscleGroup, equipment, cursor, limit = 50 },
) => {
  const params = { limit };
  if (search) params.search = search;
  if (muscleGroup && muscleGroup !== "All Muscles") params.muscleGroup = muscleGroup;
  if (equipment && equipment !== "All Equipment") params.equipment = equipment;
  if (cursor) params.cursor = cursor;

  const { data } = await api.get(API_ROUTES.exercise.base, {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getExerciseStats = async (token, exerciseId) => {
  const { data } = await api.get(API_ROUTES.exercise.stats(exerciseId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getPersonalRecords = async (token) => {
  const { data } = await api.get(API_ROUTES.exercise.records, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};
