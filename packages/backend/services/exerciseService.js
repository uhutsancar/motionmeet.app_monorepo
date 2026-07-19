import Exercise from "../models/Exercise.js";
import escapeStringRegexp from "escape-string-regexp";

export const getExercisesList = async ({ search, muscleGroup, equipment, limitNum, skipNum }) => {
  const query = {};

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

export const getExerciseById = async (id) => {
  return await Exercise.findById(id);
};

export const createExercise = async (exerciseData) => {
  return await Exercise.create({
    name: exerciseData.name.trim(),
    muscleGroup: String(exerciseData.muscleGroup || "Other").trim(),
    equipment: String(exerciseData.equipment || "Body Weight").trim(),
    gifUrl: exerciseData.gifUrl ? String(exerciseData.gifUrl).trim() : undefined,
  });
};

export const getExerciseStats = async (id, userId) => {
  const Workout = (await import("../models/Workout.js")).default;

  const workouts = await Workout.find({
    userId,
    "exercises.exerciseId": id,
  }).sort({ createdAt: -1 });

  let personalRecord = 0;
  const totalSessions = workouts.length;
  const history = [];

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

  return {
    personalRecord,
    totalSessions,
    history: history.reverse()
  };
};
