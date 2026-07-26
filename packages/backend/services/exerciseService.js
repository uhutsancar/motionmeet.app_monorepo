import Exercise from "../models/Exercise.js";
import escapeStringRegexp from "escape-string-regexp";
import mongoose from "mongoose";

export const getExercisesList = async ({
  search,
  muscleGroup,
  equipment,
  limitNum,
  skipNum,
  userId,
}) => {
  const query = {
    $or: [
      { isCustom: { $ne: true } },
      { isCustom: true, createdBy: userId },
    ],
  };

  if (search) {
    const escapedSearch = escapeStringRegexp(search.trim());
    query.name = new RegExp(escapedSearch, "i");
  }
  if (muscleGroup && muscleGroup !== "All Muscles") {
    query.muscleGroup = muscleGroup;
  }
  if (equipment && equipment !== "All Equipment") {
    query.equipment = equipment;
  }

  const [exercises, total] = await Promise.all([
    Exercise.find(query).sort({ name: 1 }).skip(skipNum).limit(limitNum),
    Exercise.countDocuments(query),
  ]);

  return { exercises, total };
};

export const getExerciseById = async (id, userId) => {
  return await Exercise.findOne({
    _id: id,
    $or: [
      { isCustom: { $ne: true } },
      { isCustom: true, createdBy: userId },
    ],
  });
};

export const createExercise = async (exerciseData) => {
  return await Exercise.create({
    name: exerciseData.name.trim(),
    muscleGroup: String(exerciseData.muscleGroup || "Other").trim(),
    equipment: String(exerciseData.equipment || "Body Weight").trim(),
    gifUrl: exerciseData.gifUrl ? String(exerciseData.gifUrl).trim() : undefined,
    isCustom: true,
    createdBy: exerciseData.userId,
  });
};

export const validateExerciseReferences = async (exercises, userId) => {
  const exerciseIds = [
    ...new Set(exercises.map((exercise) => exercise.exerciseId)),
  ];
  const count = await Exercise.countDocuments({
    _id: { $in: exerciseIds },
    $or: [
      { isCustom: { $ne: true } },
      { isCustom: true, createdBy: userId },
    ],
  });
  return count === exerciseIds.length;
};

export const getExerciseStats = async (id, userId) => {
  const Workout = (await import("../models/Workout.js")).default;
  const exerciseId = new mongoose.Types.ObjectId(id);
  const [result] = await Workout.aggregate([
    { $match: { userId, "exercises.exerciseId": exerciseId } },
    { $unwind: "$exercises" },
    { $match: { "exercises.exerciseId": exerciseId } },
    {
      $set: {
        completedSets: {
          $filter: {
            input: "$exercises.sets",
            as: "set",
            cond: {
              $or: [
                { $ne: ["$metricsVersion", 2] },
                { $eq: ["$$set.completed", true] },
              ],
            },
          },
        },
      },
    },
    {
      $project: {
        date: { $ifNull: ["$startTime", "$createdAt"] },
        maxWeight: { $max: "$completedSets.weight" },
        volume: {
          $sum: {
            $map: {
              input: "$completedSets",
              as: "set",
              in: { $multiply: ["$$set.weight", "$$set.reps"] },
            },
          },
        },
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              personalRecord: { $max: "$maxWeight" },
              totalSessions: { $sum: 1 },
            },
          },
        ],
        history: [
          { $sort: { date: -1, _id: -1 } },
          { $limit: 365 },
          { $project: { _id: 0, date: 1, maxWeight: 1, volume: 1 } },
        ],
      },
    },
  ]);
  const summary = result?.summary?.[0] || {};
  return {
    personalRecord: summary.personalRecord || 0,
    totalSessions: summary.totalSessions || 0,
    history: (result?.history || []).reverse(),
  };
};

export const getPersonalRecords = async (userId, limit = 50) => {
  const Workout = (await import("../models/Workout.js")).default;
  return Workout.aggregate([
    { $match: { userId } },
    { $unwind: "$exercises" },
    { $unwind: "$exercises.sets" },
    {
      $match: {
        $or: [
          { metricsVersion: { $ne: 2 } },
          { "exercises.sets.completed": true },
        ],
      },
    },
    {
      $sort: {
        "exercises.sets.weight": -1,
        startTime: -1,
        createdAt: -1,
      },
    },
    {
      $group: {
        _id: "$exercises.exerciseId",
        value: { $first: "$exercises.sets.weight" },
        reps: { $first: "$exercises.sets.reps" },
        recordedAt: { $first: { $ifNull: ["$startTime", "$createdAt"] } },
      },
    },
    { $sort: { value: -1, recordedAt: -1 } },
    { $limit: Math.min(Math.max(Number(limit) || 50, 1), 100) },
    {
      $lookup: {
        from: "exercises",
        localField: "_id",
        foreignField: "_id",
        as: "exercise",
      },
    },
    { $unwind: "$exercise" },
    {
      $project: {
        _id: 0,
        exerciseId: "$_id",
        name: "$exercise.name",
        value: 1,
        reps: 1,
        recordedAt: 1,
      },
    },
  ]);
};
