import Routine from "../models/Routine.js";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";

export const getUserRoutinesList = async (userId, pagination) => {
  const documents = await Routine.find({
    userId,
    ...cursorFilter(pagination.cursor, "updatedAt"),
  })
    .populate("exercises.exerciseId")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(pagination.limit + 1);
  return pageFromDocuments(documents, pagination.limit, "updatedAt");
};

export const countUserRoutines = async (userId) => {
  return await Routine.countDocuments({ userId });
};

export const createRoutine = async (routineData) => {
  const newRoutine = await Routine.create(routineData);
  return await Routine.findById(newRoutine._id).populate("exercises.exerciseId");
};

export const updateRoutine = async (id, userId, updateData) => {
  return await Routine.findOneAndUpdate(
    { _id: id, userId },
    updateData,
    { new: true }
  ).populate("exercises.exerciseId");
};

export const deleteRoutine = async (id, userId) => {
  return await Routine.findOneAndDelete({ _id: id, userId });
};
