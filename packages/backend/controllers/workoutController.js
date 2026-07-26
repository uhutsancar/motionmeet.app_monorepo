import { isExerciseList, isNonEmptyString, isOptionalString } from "../utils/validation.js";
import * as workoutService from "../services/workoutService.js";
import * as quotaService from "../services/quotaService.js";
import { parsePagination } from "../utils/pagination.js";
import { validateExerciseReferences } from "../services/exerciseService.js";
import {
  buildCanonicalWorkout,
  normalizeCompletedExercises,
} from "../utils/workoutMetrics.js";

// Log a completed workout
export const logWorkout = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { name, startTime, endTime, exercises } = req.body || {};

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);
    const nowWithClockSkew = Date.now() + 5 * 60 * 1000;
    if (
      !isNonEmptyString(name, 120) ||
      Number.isNaN(parsedStartTime.getTime()) ||
      Number.isNaN(parsedEndTime.getTime()) ||
      parsedEndTime < parsedStartTime ||
      parsedEndTime.getTime() > nowWithClockSkew ||
      parsedEndTime.getTime() - parsedStartTime.getTime() > 10_080 * 60_000 ||
      !isExerciseList(exercises)
    ) {
      return res.status(400).json({ success: false, message: "Invalid workout data" });
    }
    const completedExercises = normalizeCompletedExercises(exercises);
    if (completedExercises.length === 0) {
      return res.status(400).json({
        success: false,
        message: "A workout must contain at least one completed set",
      });
    }
    if (!(await validateExerciseReferences(completedExercises, userId))) {
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
      const canonicalWorkout = buildCanonicalWorkout({
        userId,
        name: name.trim(),
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        exercises: completedExercises,
      });
      newWorkout =
        await workoutService.createWorkoutWithStatistics(canonicalWorkout);
    } catch (error) {
      if (reservedBucket) await quotaService.releaseQuota(userId, reservedBucket);
      throw error;
    }

    res.status(201).json({ success: true, workout: newWorkout, message: "Workout logged successfully" });
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
    const { period = "month" } = req.query;

    if (
      !isOptionalString(period, 20) ||
      !["week", "month", "calendar_month", "year"].includes(period)
    ) {
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
