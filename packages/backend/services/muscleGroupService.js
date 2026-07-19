import MuscleGroup from "../models/MuscleGroup.js";

export const getMuscleGroupsList = async (filter = {}) => {
  return await MuscleGroup.find(filter).sort({ order: 1 });
};
