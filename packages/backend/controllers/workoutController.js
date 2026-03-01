import Workout from "../models/Workout.js";
import User from "../models/User.js";

// Log a completed workout
export const logWorkout = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { name, startTime, endTime, durationMinutes, volumeKg, exercises } = req.body;

    const newWorkout = await Workout.create({
      userId, name, startTime, endTime, durationMinutes, volumeKg, exercises
    });

    const user = await User.findById(userId);
    if (user) {
      user.statistics.totalWorkouts += 1;
      user.statistics.totalDurationMinutes += (durationMinutes || 0);
      user.statistics.totalVolumeKg += (volumeKg || 0);
      await user.save();
    }

    res.json({ success: true, workout: newWorkout, message: "Workout logged successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Get user workouts
export const getUserWorkouts = async (req, res) => {
  try {
    const { userId } = req.auth();
    const workouts = await Workout.find({ userId })
      .populate("exercises.exerciseId")
      .sort({ startTime: -1 });

    res.json({ success: true, workouts });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Get aggregated workout statistics for charts
export const getWorkoutStats = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { period = "month" } = req.query; // "week" | "month" | "year"

    const workouts = await Workout.find({ userId }).sort({ startTime: 1 });

    if (workouts.length === 0) {
      return res.json({
        success: true,
        stats: { labels: [], volumes: [], durations: [], reps: [] },
        exerciseBreakdown: [],
        totalVolume: 0, totalDuration: 0, totalWorkouts: 0, totalCalories: 0,
      });
    }

    const grouped = {};
    const exerciseTotals = {};
    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
          const name = ex.name || ex.exerciseId?.name || "Exercise";
          if (!exerciseTotals[name]) exerciseTotals[name] = 0;
          if (ex.sets) {
            ex.sets.forEach((s) => {
              exerciseTotals[name] += (s.reps || 0);
              grouped[label].reps += (s.reps || 0);
            });
          }
        });
      }
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

    res.json({
      success: true,
      stats: { labels, volumes, durations, reps },
      exerciseBreakdown,
      totalVolume, totalDuration, totalWorkouts, totalCalories,
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};
