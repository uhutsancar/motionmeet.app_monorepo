import api from "~/api/axios";
import { API_ROUTES } from "@motionmeet/shared";

export const getExercises = async (token, { search, muscleGroup, equipment }) => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (muscleGroup && muscleGroup !== "All Muscles") params.append("muscleGroup", muscleGroup);
  if (equipment && equipment !== "All Equipment") params.append("equipment", equipment);
  
  const { data } = await api.get(`${API_ROUTES.exercise.base}?${params.toString()}`, {
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
