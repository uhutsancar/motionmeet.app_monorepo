import Routine from "../models/Routine.js";
import mongoose from "mongoose";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";
import * as quotaService from "./quotaService.js";

const EXERCISE_PREVIEW_FIELDS =
  "name muscleGroup equipment imageUrl gifUrl";

export const getUserRoutinesList = async (userId, pagination) => {
  const documents = await Routine.find({
    userId,
    ...cursorFilter(pagination.cursor, "updatedAt"),
  })
    .populate("exercises.exerciseId", EXERCISE_PREVIEW_FIELDS)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(pagination.limit + 1);
  return pageFromDocuments(documents, pagination.limit, "updatedAt");
};

export const countUserRoutines = async (userId) => {
  return await Routine.countDocuments({ userId });
};

export const createRoutine = async (routineData, { quotaLimit = -1 } = {}) => {
  if (routineData.operationId) {
    const existing = await Routine.findOne({
      userId: routineData.userId,
      operationId: routineData.operationId,
    });
    if (existing) {
      return Routine.findById(existing._id).populate(
        "exercises.exerciseId",
        EXERCISE_PREVIEW_FIELDS
      );
    }
  }

  const session = await mongoose.startSession();
  let newRoutine = null;
  try {
    try {
      await session.withTransaction(async () => {
        if (quotaLimit !== -1) {
          const reserved = await quotaService.reserveQuota({
            userId: routineData.userId,
            bucket: quotaService.routineBucket,
            limit: quotaLimit,
            getCurrentCount: () =>
              Routine.countDocuments({ userId: routineData.userId }).session(
                session
              ),
            session,
          });
          if (!reserved) {
            throw Object.assign(
              new Error(`Routine limit reached (${quotaLimit})`),
              { status: 403 }
            );
          }
        }
        [newRoutine] = await Routine.create([routineData], { session });
      });
    } catch (error) {
      if (error?.code !== 11000 || !routineData.operationId) throw error;
      newRoutine = await Routine.findOne({
        userId: routineData.userId,
        operationId: routineData.operationId,
      });
      if (!newRoutine) throw error;
    }
  } finally {
    await session.endSession();
  }
  return await Routine.findById(newRoutine._id).populate(
    "exercises.exerciseId",
    EXERCISE_PREVIEW_FIELDS
  );
};

export const updateRoutine = async (id, userId, updateData) => {
  return await Routine.findOneAndUpdate(
    { _id: id, userId },
    updateData,
    { new: true, runValidators: true }
  ).populate("exercises.exerciseId", EXERCISE_PREVIEW_FIELDS);
};

export const deleteRoutine = async (id, userId) => {
  const session = await mongoose.startSession();
  let routine = null;
  try {
    await session.withTransaction(async () => {
      routine = await Routine.findOneAndDelete(
        { _id: id, userId },
        { session }
      );
      if (routine) {
        await quotaService.releaseQuota(userId, quotaService.routineBucket, {
          session,
        });
      }
    });
    return routine;
  } finally {
    await session.endSession();
  }
};
