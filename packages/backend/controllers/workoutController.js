import { isExerciseList, isFiniteNumber, isNonEmptyString, isOptionalString } from "../utils/validation.js";
import * as workoutService from "../services/workoutService.js";
import * as quotaService from "../services/quotaService.js";
import { parsePagination } from "../utils/pagination.js";
import { validateExerciseReferences } from "../services/exerciseService.js";

// Log a completed workout
export const logWorkout = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { name, startTime, endTime, durationMinutes, volumeKg, exercises } = req.body || {};

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = endTime ? new Date(endTime) : undefined;
    if (
      !isNonEmptyString(name, 120) ||
      Number.isNaN(parsedStartTime.getTime()) ||
      (parsedEndTime && (Number.isNaN(parsedEndTime.getTime()) || parsedEndTime < parsedStartTime)) ||
      !isFiniteNumber(durationMinutes || 0, { min: 0, max: 10080 }) ||
      !isFiniteNumber(volumeKg || 0, { min: 0, max: 100000000 }) ||
      !isExerciseList(exercises)
    ) {
      return res.status(400).json({ success: false, message: "Invalid workout data" });
    }
    if (!(await validateExerciseReferences(exercises, userId))) {
      return res.status(400).json({ success: false, message: "Workout contains unavailable exercises" });
    }

    let reservedBucket = null;
    if (req.dbUser && req.dbUser.plan) {
      if (req.dbUser.role !== "superadmin") {
          const limit = req.dbUser.plan.features.max_workouts_per_month;
          if (limit !== -1) {
          const now = new Date();
          const startOfMonth = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
          );

          reservedBucket = quotaService.workoutBucket();
          const reserved = await quotaService.reserveQuota({
            userId,
            bucket: reservedBucket,
            limit,
            getCurrentCount: () =>
              workoutService.countUserWorkoutsFromDate(userId, startOfMonth),
          });

          if (!reserved) {
            return res.status(403).json({ success: false, message: `Monthly workout limit reached (${limit}). Please upgrade your plan.` });
          }
        }
      }
    }

    let newWorkout;
    try {
      newWorkout = await workoutService.createWorkoutWithStatistics({
        userId,
        name: name.trim(),
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        durationMinutes: Number(durationMinutes || 0),
        volumeKg: Number(volumeKg || 0),
        exercises,
      });
    } catch (error) {
      if (reservedBucket) await quotaService.releaseQuota(userId, reservedBucket);
      throw error;
    }

    res.json({ success: true, workout: newWorkout, message: "Workout logged successfully" });
  } catch (error) {
    next(error);
  }
};

// Get user workouts
export const getUserWorkouts = async (req, res, next) => {
  try {
    const userId = req.userId;
    const pagination = parsePagination(req.query, { defaultLimit: 30, maxLimit: 100 });
    const { items: workouts, nextCursor } =
      await workoutService.getUserWorkoutsList(userId, pagination);

    res.json({ success: true, workouts, nextCursor });
  } catch (error) {
    next(error);
  }
};

// Get aggregated workout statistics for charts
export const getWorkoutStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { period = "month" } = req.query; // "week" | "month" | "year"

    if (!isOptionalString(period, 10) || !["week", "month", "year"].includes(period)) {
      return res.status(400).json({ success: false, message: "Invalid statistics period" });
    }

    const statsData = await workoutService.getWorkoutStatsData(userId, period);

    res.json({
      success: true,
      ...statsData
    });
  } catch (error) {
    next(error);
  }
};
