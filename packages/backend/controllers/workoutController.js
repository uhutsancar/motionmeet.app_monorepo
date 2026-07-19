import { isExerciseList, isFiniteNumber, isNonEmptyString, isOptionalString } from "../utils/validation.js";
import * as workoutService from "../services/workoutService.js";

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

    // Role-Based Plan Limits
    if (req.dbUser && req.dbUser.plan) {
      if (req.dbUser.role !== "superadmin") {
        const limit = req.dbUser.plan.features.max_workouts_per_month;
        if (limit !== -1) {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const count = await workoutService.countUserWorkoutsFromDate(req.dbUser._id, startOfMonth);
          
          if (count >= limit) {
            return res.status(403).json({ success: false, message: `Monthly workout limit reached (${limit}). Please upgrade your plan.` });
          }
        }
      }
    }

    const newWorkout = await workoutService.createWorkout({
      userId,
      name: name.trim(),
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      durationMinutes: Number(durationMinutes || 0),
      volumeKg: Number(volumeKg || 0),
      exercises,
    });

    await workoutService.updateUserStatistics(userId, durationMinutes, volumeKg);

    res.json({ success: true, workout: newWorkout, message: "Workout logged successfully" });
  } catch (error) {
    next(error);
  }
};

// Get user workouts
export const getUserWorkouts = async (req, res, next) => {
  try {
    const userId = req.userId;
    const workouts = await workoutService.getUserWorkoutsList(userId);

    res.json({ success: true, workouts });
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
