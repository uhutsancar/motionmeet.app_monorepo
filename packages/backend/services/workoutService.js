import Workout from "../models/Workout.js";
import User from "../models/User.js";
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
  let workout;
  try {
    workout = await Workout.create(workoutData);
    const result = await User.updateOne(
      { _id: workoutData.userId },
      {
        $inc: {
          "statistics.totalWorkouts": 1,
          "statistics.totalDurationMinutes": Number(workoutData.durationMinutes || 0),
          "statistics.totalVolumeKg": Number(workoutData.volumeKg || 0),
        },
      }
    );
    if (result.matchedCount !== 1) throw new Error("Workout owner no longer exists");
    return workout;
  } catch (error) {
    if (workout?._id) await Workout.deleteOne({ _id: workout._id });
    throw error;
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

export const getWorkoutStatsData = async (userId, period) => {
  const now = new Date();
  const windowDays = period === "week" ? 7 : period === "month" ? 30 : 365;
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays + 1);
  cutoff.setUTCHours(0, 0, 0, 0);

  const workouts = await Workout.find({
    userId,
    startTime: { $gte: cutoff, $lte: now },
  })
    .select("startTime createdAt durationMinutes volumeKg exercises")
    .populate("exercises.exerciseId", "name muscleGroup")
    .sort({ startTime: 1, _id: 1 })
    .lean();

  const MuscleGroup = (await import("../models/MuscleGroup.js")).default;
  const activeMuscleGroups = await MuscleGroup.find({ isActive: true }).lean();
  
  const muscleDistribution = {};
  activeMuscleGroups.forEach((mg) => { muscleDistribution[mg.code] = 0; });

  if (workouts.length === 0) {
    return {
      stats: { labels: [], volumes: [], durations: [], reps: [] },
      exerciseBreakdown: [],
      muscleDistribution,
      totalVolume: 0, totalDuration: 0, totalWorkouts: 0, totalCalories: 0, totalSets: 0,
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
    const label = period === "year"
      ? d.toLocaleDateString("en-US", {
          month: "short",
          timeZone: "UTC",
          year: "2-digit",
        })
      : d.toLocaleDateString("en-US", {
          day: period === "month" ? "numeric" : undefined,
          month: period === "month" ? "short" : undefined,
          timeZone: "UTC",
          weekday: period === "week" ? "short" : undefined,
        });

    if (!grouped[label]) grouped[label] = { volume: 0, duration: 0, reps: 0 };
    grouped[label].volume += w.volumeKg || 0;
    grouped[label].duration += w.durationMinutes || 0;

    if (w.exercises) {
      w.exercises.forEach((ex) => {
        const exerciseDoc = /** @type {any} */ (ex.exerciseId);
        const name = exerciseDoc?.name || "Exercise";
        const rawMuscle = (exerciseDoc?.muscleGroup || "").toLowerCase();
        const normalizedMuscle = muscleMap[rawMuscle] || rawMuscle;

        if (!exerciseTotals[name]) exerciseTotals[name] = 0;

        if (ex.sets) {
          ex.sets.forEach((s) => {
            const reps = s.reps || 0;
            const vol = (s.weight || 0) * reps;
            exerciseTotals[name] += reps;
            grouped[label].reps += reps;
            totalSets += 1;
            if (normalizedMuscle && muscleDistribution[normalizedMuscle] !== undefined) {
              muscleDistribution[normalizedMuscle] += vol;
            }
          });
        }
      });
    }
  });

  const maxMuscleVol = Math.max(...Object.values(muscleDistribution), 1);
  const muscleDistributionNormalized = {};
  Object.entries(muscleDistribution).forEach(([k, v]) => {
    muscleDistributionNormalized[k] = parseFloat((v / maxMuscleVol).toFixed(3));
  });

  const labels = Object.keys(grouped);
  const volumes = labels.map((l) => Math.round(grouped[l].volume));
  const durations = labels.map((l) => grouped[l].duration);
  const reps = labels.map((l) => grouped[l].reps);

  const exerciseBreakdown = Object.entries(exerciseTotals)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, total]) => ({ name, total }));

  const totalVolume = Math.round(workouts.reduce((s, w) => s + (w.volumeKg || 0), 0));
  const totalDuration = workouts.reduce((s, w) => s + (w.durationMinutes || 0), 0);
  const totalWorkouts = workouts.length;
  const totalCalories = Math.round(totalDuration * 8);

  return {
    stats: { labels, volumes, durations, reps },
    exerciseBreakdown,
    muscleDistribution: muscleDistributionNormalized,
    totalVolume, totalDuration, totalWorkouts, totalCalories, totalSets,
  };
};
