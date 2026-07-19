import Workout from "../models/Workout.js";
import User from "../models/User.js";

export const countUserWorkoutsFromDate = async (userId, startDate) => {
  return await Workout.countDocuments({ 
    userId,
    createdAt: { $gte: startDate }
  });
};

export const createWorkout = async (workoutData) => {
  return await Workout.create(workoutData);
};

export const updateUserStatistics = async (userId, durationMinutes, volumeKg) => {
  await User.updateOne(
    { _id: userId },
    {
      $inc: {
        "statistics.totalWorkouts": 1,
        "statistics.totalDurationMinutes": Number(durationMinutes || 0),
        "statistics.totalVolumeKg": Number(volumeKg || 0),
      },
    }
  );
};

export const getUserWorkoutsList = async (userId) => {
  return await Workout.find({ userId })
    .populate("exercises.exerciseId")
    .sort({ startTime: -1 });
};

export const getWorkoutStatsData = async (userId, period) => {
  const workouts = await Workout.find({ userId })
    .populate("exercises.exerciseId")
    .sort({ startTime: 1 });

  const MuscleGroup = (await import("../models/MuscleGroup.js")).default;
  const activeMuscleGroups = await MuscleGroup.find({ isActive: true });
  
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
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
    let label;
    if (period === "week") label = DAY_NAMES[d.getDay()];
    else if (period === "month") label = MONTH_NAMES[d.getMonth()];
    else label = String(d.getFullYear());

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
