import { isExerciseList, isNonEmptyString, isObjectId, isOptionalString } from "../utils/validation.js";
import * as routineService from "../services/routineService.js";
import * as quotaService from "../services/quotaService.js";
import { parsePagination } from "../utils/pagination.js";
import { validateExerciseReferences } from "../services/exerciseService.js";

// Get user routines
export const getUserRoutines = async (req, res, next) => {
  try {
    const userId = req.userId;
    const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const { items: routines, nextCursor } =
      await routineService.getUserRoutinesList(userId, pagination);
    res.json({ success: true, routines, nextCursor });
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
    if (!(await validateExerciseReferences(exercises, userId))) {
      return res.status(400).json({ success: false, message: "Routine contains unavailable exercises" });
    }

    let quotaReserved = false;
    if (req.dbUser && req.dbUser.plan) {
      if (req.dbUser.role !== "superadmin") {
        const limit = req.dbUser.plan.features.max_routines;
        if (limit !== -1) {
          quotaReserved = await quotaService.reserveQuota({
            userId,
            bucket: quotaService.routineBucket,
            limit,
            getCurrentCount: () => routineService.countUserRoutines(userId),
          });
          if (!quotaReserved) {
            return res.status(403).json({ success: false, message: `Routine limit reached for the current plan (${limit}).` });
          }
        }
      }
    }

    let populated;
    try {
      populated = await routineService.createRoutine({
        userId,
        name: name.trim(),
        folder: folder || "My Routines",
        exercises
      });
    } catch (error) {
      if (quotaReserved) {
        await quotaService.releaseQuota(userId, quotaService.routineBucket);
      }
      throw error;
    }

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
      if (!(await validateExerciseReferences(exercises, userId))) {
        return res.status(400).json({ success: false, message: "Routine contains unavailable exercises" });
      }
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

    await quotaService.releaseQuota(userId, quotaService.routineBucket);
    res.json({ success: true, message: "Routine deleted successfully" });
  } catch (error) {
    next(error);
  }
};
