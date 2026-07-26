import { isNonEmptyString, isObjectId, isOptionalHttpUrl, isOptionalString } from "../utils/validation.js";
import * as exerciseService from "../services/exerciseService.js";

// Get all exercises with optional filtering
export const getExercises = async (req, res, next) => {
  try {
    const { search, muscleGroup, equipment, limit = 50, skip = 0 } = req.query;

    if (!isOptionalString(search, 100) || !isOptionalString(muscleGroup, 100) || !isOptionalString(equipment, 100)) {
      return res.status(400).json({ success: false, message: "Invalid exercise filters" });
    }

    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const skipNum = Math.max(parseInt(skip) || 0, 0);

    const { exercises, total } = await exerciseService.getExercisesList({
      search,
      muscleGroup,
      equipment,
      limitNum,
      skipNum,
      userId: req.userId,
    });

    res.json({ success: true, exercises, total, limit: limitNum, skip: skipNum });
  } catch (error) {
    next(error);
  }
};

// Get single exercise
export const getExerciseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid exercise id" });
    }

    const exercise = await exerciseService.getExerciseById(id, req.userId);
    if (!exercise) {
      return res.json({ success: false, message: "Exercise not found" });
    }
    res.json({ success: true, exercise });
  } catch (error) {
    next(error);
  }
};

// Create a custom exercise
export const createExercise = async (req, res, next) => {
  try {
    const { name, muscleGroup, equipment, gifUrl } = req.body || {};

    if (!isNonEmptyString(name, 80)) {
      return res.status(400).json({ success: false, message: "Invalid exercise name" });
    }

    if (!isNonEmptyString(muscleGroup || "Other", 80) || !isNonEmptyString(equipment || "Body Weight", 80)) {
      return res.status(400).json({ success: false, message: "Invalid exercise details" });
    }

    if (!isOptionalHttpUrl(gifUrl)) {
      return res.status(400).json({ success: false, message: "Invalid exercise media URL" });
    }

    const newExercise = await exerciseService.createExercise({
      name,
      muscleGroup,
      equipment,
      gifUrl,
      userId: req.userId,
    });
    res.status(201).json({ success: true, exercise: newExercise, message: "Exercise created successfully" });
  } catch (error) {
    next(error);
  }
};

// Get stats for a specific exercise
export const getExerciseStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    if (!isObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid exercise id" });
    }

    const stats = await exerciseService.getExerciseStats(id, userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    next(error);
  }
};

export const getPersonalRecords = async (req, res, next) => {
  try {
    const records = await exerciseService.getPersonalRecords(
      req.userId,
      req.query?.limit
    );
    return res.json({ success: true, records });
  } catch (error) {
    return next(error);
  }
};
