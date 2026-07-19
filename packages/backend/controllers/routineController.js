import { isExerciseList, isNonEmptyString, isObjectId, isOptionalString } from "../utils/validation.js";
import * as routineService from "../services/routineService.js";

// Get user routines
export const getUserRoutines = async (req, res, next) => {
  try {
    const userId = req.userId;
    const routines = await routineService.getUserRoutinesList(userId);
    res.json({ success: true, routines });
  } catch (error) {
    next(error);
  }
};

// Create a new routine
export const createRoutine = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { name, folder, exercises } = req.body || {};

    if (!isNonEmptyString(name, 120)) {
      return res.status(400).json({ success: false, message: "Routine name is required" });
    }
    if (!isOptionalString(folder, 120) || !isExerciseList(exercises)) {
      return res.status(400).json({ success: false, message: "Invalid routine exercises or folder" });
    }

    // Role-Based Plan Limits
    if (req.dbUser && req.dbUser.plan) {
      if (req.dbUser.role !== "superadmin") {
        const limit = req.dbUser.plan.features.max_routines;
        if (limit !== -1) {
          const count = await routineService.countUserRoutines(req.dbUser._id);
          if (count >= limit) {
            return res.json({ success: false, message: `Routine limit reached (${limit}). Please upgrade your plan to Elite.` });
          }
        }
      }
    }

    const populated = await routineService.createRoutine({
      userId,
      name: name.trim(),
      folder: folder || "My Routines",
      exercises
    });

    res.json({ success: true, routine: populated, message: "Routine created successfully" });
  } catch (error) {
    next(error);
  }
};

// Update a routine
export const updateRoutine = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid routine id" });
    }

    // Prevent Mass Assignment by extracting only the safe fields
    const { name, folder, exercises } = req.body || {};
    const updateData = {};
    if (name !== undefined) {
      if (!isNonEmptyString(name, 120)) return res.status(400).json({ success: false, message: "Invalid routine name" });
      updateData.name = name.trim();
    }
    if (folder !== undefined) {
      if (!isOptionalString(folder, 120)) return res.status(400).json({ success: false, message: "Invalid routine folder" });
      updateData.folder = folder.trim();
    }
    if (exercises !== undefined) {
      if (!isExerciseList(exercises)) return res.status(400).json({ success: false, message: "Invalid routine exercises" });
      updateData.exercises = exercises;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "No valid routine fields supplied" });
    }

    const routine = await routineService.updateRoutine(id, userId, updateData);

    if (!routine) {
      return res.json({ success: false, message: "Routine not found or not authorized" });
    }

    res.json({ success: true, routine, message: "Routine updated successfully" });
  } catch (error) {
    next(error);
  }
};

// Delete a routine
export const deleteRoutine = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid routine id" });
    }

    const routine = await routineService.deleteRoutine(id, userId);

    if (!routine) {
      return res.json({ success: false, message: "Routine not found or not authorized" });
    }

    res.json({ success: true, message: "Routine deleted successfully" });
  } catch (error) {
    next(error);
  }
};
