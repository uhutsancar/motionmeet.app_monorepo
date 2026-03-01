import Workout from "../models/Workout.js";
import User from "../models/User.js";

// Log a completed workout
export const logWorkout = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { name, startTime, endTime, durationMinutes, volumeKg, exercises } = req.body;

    const newWorkout = await Workout.create({
      userId,
      name,
      startTime,
      endTime,
      durationMinutes,
      volumeKg,
      exercises
    });

    // Update user stats
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
