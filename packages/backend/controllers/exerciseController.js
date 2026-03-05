import Exercise from "../models/Exercise.js";
import escapeStringRegexp from "escape-string-regexp";

// Get all exercises with optional filtering
export const getExercises = async (req, res) => {
  try {
    const { search, muscleGroup, equipment } = req.query;
    let query = {};

    if (search) {
      const escapedSearch = escapeStringRegexp(search || "");
      query.name = new RegExp(escapedSearch, "i");
    }
    if (muscleGroup && muscleGroup !== "All Muscles") {
      query.muscleGroup = muscleGroup;
    }
    if (equipment && equipment !== "All Equipment") {
      query.equipment = equipment;
    }

    const exercises = await Exercise.find(query).sort({ name: 1 });
    res.json({ success: true, exercises });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Get single exercise
export const getExerciseById = async (req, res) => {
  try {
    const { id } = req.params;
    const exercise = await Exercise.findById(id);
    if (!exercise) {
      return res.json({ success: false, message: "Exercise not found" });
    }
    res.json({ success: true, exercise });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Create a custom exercise
export const createExercise = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { name, muscleGroup, equipment, gifUrl } = req.body;

    // Basic Input Validation for Global Resource
    if (!name || typeof name !== "string" || name.length > 50) {
      return res.json({ success: false, message: "Invalid exercise name" });
    }
    
    // In a fully robust system, you'd check `userId` against an Admin roles table here,
    // or tag the created exercise with the `userId` to limit its scope.
    // For now, we enforce strict data types to prevent NoSQL Injection/Data corruption.

    const newExercise = await Exercise.create({
      name: name.trim(),
      muscleGroup: String(muscleGroup || "Other").trim(),
      equipment: String(equipment || "Body Weight").trim(),
      gifUrl: gifUrl ? String(gifUrl).trim() : undefined,
    });
    res.json({ success: true, exercise: newExercise, message: "Exercise created successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Get stats for a specific exercise
export const getExerciseStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = await req.auth();
    const Workout = (await import("../models/Workout.js")).default;

    // Find all workouts that contain this exercise for this user
    const workouts = await Workout.find({
      userId,
      "exercises.exerciseId": id,
    }).sort({ createdAt: -1 });

    let personalRecord = 0;
    let totalSessions = workouts.length;
    let history = [];

    workouts.forEach(w => {
      const ex = w.exercises.find(e => e.exerciseId.toString() === id);
      if (ex) {
        let maxWeight = 0;
        ex.sets.forEach(s => {
          if (s.weight > maxWeight) maxWeight = s.weight;
          if (s.weight > personalRecord) personalRecord = s.weight;
        });
        history.push({
          date: w.createdAt,
          maxWeight,
          volume: ex.sets.reduce((acc, s) => acc + (s.weight * s.reps), 0)
        });
      }
    });

    res.json({
      success: true,
      stats: {
        personalRecord,
        totalSessions,
        history: history.reverse() // from oldest to newest for charts
      }
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

