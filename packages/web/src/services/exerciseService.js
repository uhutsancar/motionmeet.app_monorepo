import api from "~/api/axios";

export const getExercises = async (token, { search, muscleGroup, equipment }) => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (muscleGroup && muscleGroup !== "All Muscles") params.append("muscleGroup", muscleGroup);
  if (equipment && equipment !== "All Equipment") params.append("equipment", equipment);
  
  const { data } = await api.get(`/api/exercise?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getExerciseStats = async (token, exerciseId) => {
  const { data } = await api.get(`/api/exercise/${exerciseId}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};
