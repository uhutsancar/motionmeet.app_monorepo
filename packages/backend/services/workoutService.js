import Workout from "../models/Workout.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import {
  cursorFilter,
  pageFromDocuments,
} from "../utils/pagination.js";

export const countUserWorkoutsFromDate = async (userId, startDate) => {
  return await Workout.countDocuments({ 
    userId,
    createdAt: { $gte: startDate }
  });
};

export const createWorkoutWithStatistics = async (workoutData) => {
  const session = await mongoose.startSession();
  let workout = null;
  try {
    await session.withTransaction(async () => {
      [workout] = await Workout.create([workoutData], { session });
      const result = await User.updateOne(
        { _id: workoutData.userId },
        {
          $inc: {
            "statistics.totalWorkouts": 1,
            "statistics.totalDurationMinutes": Number(workoutData.durationMinutes || 0),
            "statistics.totalVolumeKg": Number(workoutData.volumeKg || 0),
          },
        },
        { session }
      );
      if (result.matchedCount !== 1) {
        throw new Error("Workout owner no longer exists");
      }
    });
    return workout;
  } finally {
    await session.endSession();
  }
};

export const getUserWorkoutsList = async (userId, pagination) => {
  const documents = await Workout.find({
    userId,
    ...cursorFilter(pagination.cursor, "startTime"),
  })
    .populate("exercises.exerciseId")
    .sort({ startTime: -1, _id: -1 })
    .limit(pagination.limit + 1);
  return pageFromDocuments(documents, pagination.limit, "startTime");
};

const dateKey = (value) => new Date(value).toISOString().slice(0, 10);

const getCurrentWorkoutStreak = async (userId, now) => {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  let expected = null;
  let previousKey = null;
  let streak = 0;
  const cursor = Workout.find({ userId, startTime: { $lte: now } })
    .select("startTime createdAt")
    .sort({ startTime: -1, _id: -1 })
    .lean()
    .cursor();

  for await (const workout of cursor) {
    const key = dateKey(workout.startTime || workout.createdAt);
    if (key === previousKey) continue;
    previousKey = key;

    if (!expected) {
      if (key === dateKey(today)) expected = today;
      else if (key === dateKey(yesterday)) expected = yesterday;
      else break;
    }

    if (key !== dateKey(expected)) break;
    streak += 1;
    expected.setUTCDate(expected.getUTCDate() - 1);
  }

  return streak;
};

export const getWorkoutStatsData = async (userId, period) => {
  const now = new Date();
  const isMonthly = period === "month" || period === "calendar_month";
  const cutoff =
    period === "calendar_month"
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      : new Date(now);
  if (period !== "calendar_month") {
    const windowDays = period === "week" ? 7 : period === "month" ? 30 : 365;
    cutoff.setUTCDate(cutoff.getUTCDate() - windowDays + 1);
    cutoff.setUTCHours(0, 0, 0, 0);
  }

  const workouts = await Workout.find({
    userId,
    startTime: { $gte: cutoff, $lte: now },
  })
    .select("startTime createdAt durationMinutes volumeKg totalSets totalReps metricsVersion exercises")
    .populate("exercises.exerciseId", "name muscleGroup")
    .sort({ startTime: 1, _id: 1 })
    .lean();

  const MuscleGroup = (await import("../models/MuscleGroup.js")).default;
  const activeMuscleGroups = await MuscleGroup.find({ isActive: true }).lean();
  
  const muscleDistribution = {};
  activeMuscleGroups.forEach((mg) => { muscleDistribution[mg.code] = 0; });

  if (workouts.length === 0) {
    return {
      stats: { labels: [], dates: [], volumes: [], durations: [], reps: [], sets: [], workouts: [] },
      exerciseBreakdown: [],
      muscleDistribution,
      totalVolume: 0, totalDuration: 0, totalWorkouts: 0, totalSets: 0,
      currentStreakDays: 0,
    };
  }

  const grouped = {};
  const exerciseTotals = {};
  let totalSets = 0;

  const muscleMap = {
    "chest": "chest", "back": "back", "lats": "back", "lower back": "back",
    "legs": "legs", "quadriceps": "legs", "hamstrings": "legs", "calves": "legs", "glutes": "legs",
    "shoulders": "shoulders",
    "arms": "arms", "biceps": "arms", "triceps": "arms", "forearms": "arms",
    "abs": "abs", "abdominals": "abs", "core": "abs",
    "cardio": "cardio", "full body": "full_body",
  };

  workouts.forEach((w) => {
    const d = new Date(w.startTime || w.createdAt);
    const key = period === "year"
      ? d.toISOString().slice(0, 7)
      : d.toISOString().slice(0, 10);
    const label = period === "year"
      ? d.toLocaleDateString("en-US", {
          month: "short",
          timeZone: "UTC",
          year: "2-digit",
        })
      : d.toLocaleDateString("en-US", {
          day: isMonthly ? "numeric" : undefined,
          month: isMonthly ? "short" : undefined,
          timeZone: "UTC",
          weekday: isMonthly ? undefined : "short",
        });

    if (!grouped[key]) {
      grouped[key] = { label, volume: 0, duration: 0, reps: 0, sets: 0, workouts: 0 };
    }
    grouped[key].volume += w.volumeKg || 0;
    grouped[key].duration += w.durationMinutes || 0;
    grouped[key].workouts += 1;

    if (w.exercises) {
      w.exercises.forEach((ex) => {
        const exerciseDoc = /** @type {any} */ (ex.exerciseId);
        const name = exerciseDoc?.name || "Exercise";
        const rawMuscle = (exerciseDoc?.muscleGroup || "").toLowerCase();
        const normalizedMuscle = muscleMap[rawMuscle] || rawMuscle;

        if (!exerciseTotals[name]) {
          exerciseTotals[name] = { volume: 0, reps: 0, sets: 0 };
        }

        if (ex.sets) {
          ex.sets.forEach((s) => {
            if (w.metricsVersion === 2 && s.completed === false) return;
            const reps = s.reps || 0;
            const vol = (s.weight || 0) * reps;
            exerciseTotals[name].volume += vol;
            exerciseTotals[name].reps += reps;
            exerciseTotals[name].sets += 1;
            grouped[key].reps += reps;
            grouped[key].sets += 1;
            totalSets += 1;
            if (normalizedMuscle && muscleDistribution[normalizedMuscle] !== undefined) {
              muscleDistribution[normalizedMuscle] += 1;
            }
          });
        }
      });
    }
  });

  const totalMuscleSets = Object.values(muscleDistribution)
    .reduce((sum, value) => sum + value, 0);
  const muscleDistributionNormalized = {};
  Object.entries(muscleDistribution).forEach(([k, v]) => {
    muscleDistributionNormalized[k] = totalMuscleSets
      ? parseFloat((v / totalMuscleSets).toFixed(3))
      : 0;
  });

  const dates = Object.keys(grouped);
  const labels = dates.map((key) => grouped[key].label);
  const volumes = dates.map((key) => Math.round(grouped[key].volume));
  const durations = dates.map((key) => grouped[key].duration);
  const reps = dates.map((key) => grouped[key].reps);
  const sets = dates.map((key) => grouped[key].sets);
  const workoutCounts = dates.map((key) => grouped[key].workouts);

  const exerciseBreakdown = Object.entries(exerciseTotals)
    .sort((a, b) => b[1].volume - a[1].volume).slice(0, 5)
    .map(([name, totals]) => ({ name, total: Math.round(totals.volume), ...totals }));

  const totalVolume = Math.round(workouts.reduce((s, w) => s + (w.volumeKg || 0), 0));
  const totalDuration = workouts.reduce((s, w) => s + (w.durationMinutes || 0), 0);
  const totalWorkouts = workouts.length;
  const workoutDates = [
    ...new Set(
      workouts.map((workout) =>
        new Date(workout.startTime || workout.createdAt)
          .toISOString()
          .slice(0, 10)
      )
    ),
  ];

  return {
    stats: { labels, dates, volumes, durations, reps, sets, workouts: workoutCounts },
    exerciseBreakdown,
    muscleDistribution: muscleDistributionNormalized,
    totalVolume, totalDuration, totalWorkouts, totalSets,
    workoutDates,
    currentStreakDays: await getCurrentWorkoutStreak(userId, now),
  };
};
