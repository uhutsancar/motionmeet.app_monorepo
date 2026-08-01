import { isExerciseList, isNonEmptyString, isOptionalString, isUuid } from "../utils/validation.js";
import type { RequestHandler } from "express";
import * as routineService from "../services/routineService.js";
import { parsePagination } from "../utils/pagination.js";
import { addExerciseSnapshots, validateExerciseReferences } from "../services/exerciseService.js";

// Get user routines
export const getUserRoutines: RequestHandler = async (req, res, next) => {
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
export const createRoutine: RequestHandler = async (req, res, next) => {
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

    const operationId = req.get("Idempotency-Key") || req.body?.operationId;
    if (
      typeof operationId !== "string" ||
      operationId.length < 8 ||
      operationId.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required",
      });
    }

    const exercisesWithSnapshots = await addExerciseSnapshots(exercises, userId);
    const quotaLimit =
      req.dbUser?.role === "superadmin"
        ? -1
        : req.dbUser?.plan && typeof req.dbUser.plan === "object"
          ? req.dbUser.plan.features.max_routines
          : -1;
    const populated = await routineService.createRoutine(
      {
        userId,
        operationId,
        name: name.trim(),
        folder: folder || "My Routines",
        exercises: exercisesWithSnapshots,
      },
      { quotaLimit }
    );

    res.json({ success: true, routine: populated, message: "Routine created successfully" });
  } catch (error) {
    next(error);
  }
};

// Update a routine
export const updateRoutine: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(400).json({ success: false, message: "Invalid routine id" });
    }

    // Prevent Mass Assignment by extracting only the safe fields
    const { name, folder, exercises } = req.body || {};
    const updateData: { name?: string; folder?: string; exercises?: Awaited<ReturnType<typeof addExerciseSnapshots>> } = {};
    if (name !== undefined) {
      if (!isNonEmptyString(name, 120)) return res.status(400).json({ success: false, message: "Invalid routine name" });
      updateData.name = name.trim();
    }
    if (folder !== undefined) {
      if (!isOptionalString(folder, 120)) return res.status(400).json({ success: false, message: "Invalid routine folder" });
      updateData.folder = folder?.trim() ?? "";
    }
    if (exercises !== undefined) {
      if (!isExerciseList(exercises)) return res.status(400).json({ success: false, message: "Invalid routine exercises" });
      if (!(await validateExerciseReferences(exercises, userId))) {
        return res.status(400).json({ success: false, message: "Routine contains unavailable exercises" });
      }
      updateData.exercises = await addExerciseSnapshots(exercises, userId);
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
export const deleteRoutine: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!isUuid(id)) {
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
