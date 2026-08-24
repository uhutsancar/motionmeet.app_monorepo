import { isExerciseList, isNonEmptyString, isOptionalString, isUuid } from "../utils/validation.js";
import type { RequestHandler } from "express";
import * as workoutService from "../services/workoutService.js";
import { parsePagination } from "../utils/pagination.js";
import { addExerciseSnapshots, validateExerciseReferences } from "../services/exerciseService.js";
import {
  buildCanonicalWorkout,
  normalizeCompletedExercises,
} from "../utils/workoutMetrics.js";
import {
  buildWorkoutShareCardData,
  isShareCardSize,
  isShareCardTemplate,
  renderShareCardPng,
} from "../services/shareCardService.js";

// Log a completed workout
export const logWorkout: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { name, startTime, endTime, exercises } = req.body || {};

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);
    const nowWithClockSkew = Date.now() + 5 * 60 * 1000;
    if (
      !isNonEmptyString(name, 120) ||
      Number.isNaN(parsedStartTime.getTime()) ||
      Number.isNaN(parsedEndTime.getTime()) ||
      parsedEndTime < parsedStartTime ||
      parsedEndTime.getTime() > nowWithClockSkew ||
      parsedEndTime.getTime() - parsedStartTime.getTime() > 10_080 * 60_000 ||
      !isExerciseList(exercises)
    ) {
      return res.status(400).json({ success: false, message: "Invalid workout data" });
    }
    const completedExercises = normalizeCompletedExercises(exercises);
    if (completedExercises.length === 0) {
      return res.status(400).json({
        success: false,
        message: "A workout must contain at least one completed set",
      });
    }
    if (!(await validateExerciseReferences(completedExercises, userId))) {
      return res.status(400).json({ success: false, message: "Workout contains unavailable exercises" });
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

    const exercisesWithSnapshots = await addExerciseSnapshots(
      completedExercises,
      userId
    );
    const canonicalWorkout = buildCanonicalWorkout({
      userId,
      operationId,
      name: name.trim(),
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      exercises: exercisesWithSnapshots,
    });
    const quotaLimit =
      req.dbUser?.role === "superadmin"
        ? -1
        : req.dbUser?.plan && typeof req.dbUser.plan === "object"
          ? req.dbUser.plan.features.max_workouts_per_month
          : -1;
    const newWorkout = await workoutService.createWorkoutWithStatistics(
      canonicalWorkout,
      { quotaLimit }
    );

    res.status(201).json({ success: true, workout: newWorkout, message: "Workout logged successfully" });
  } catch (error) {
    next(error);
  }
};

// Get user workouts
export const getUserWorkouts: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;
    const pagination = parsePagination(req.query, { defaultLimit: 30, maxLimit: 100 });
    const { items: workouts, nextCursor } =
      await workoutService.getUserWorkoutsList(userId, pagination);

    res.json({ success: true, workouts, nextCursor });
  } catch (error) {
    next(error);
  }
};

// Get aggregated workout statistics for charts
export const getWorkoutStats: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { period = "month" } = req.query;

    if (
      !isOptionalString(period, 20) ||
      !["week", "month", "calendar_month", "year"].includes(period)
    ) {
      return res.status(400).json({ success: false, message: "Invalid statistics period" });
    }

    const statsData = await workoutService.getWorkoutStatsData(userId, period);

    res.json({
      success: true,
      ...statsData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * The share card for one of the member's own workouts, as a PNG.
 *
 * Answers with an image rather than JSON because that is what the caller does
 * with it: writes it to the camera roll, hands it to Instagram, attaches it to
 * a message. The app previews the identical card locally from the same shared
 * renderer, so this endpoint is only reached when a real file is needed.
 */
export const getWorkoutShareCard: RequestHandler = async (req, res, next) => {
  try {
    const workoutId = req.params.workoutId;
    if (!isUuid(workoutId)) {
      return res.status(400).json({ success: false, message: "Invalid workout id" });
    }

    const template = isShareCardTemplate(req.query.template) ? req.query.template : "summary";
    const size = isShareCardSize(req.query.size) ? req.query.size : "story";

    const data = await buildWorkoutShareCardData(workoutId, req.userId);
    if (!data) return res.status(404).json({ success: false, message: "Workout not found" });


    const png = await renderShareCardPng(data, template, size);
    return res
      .status(200)
      .set("Content-Type", "image/png")
      // The card is derived entirely from a finished workout, so it can never
      // change; a long private cache saves re-rendering it on every retry.
      .set("Cache-Control", "private, max-age=86400")
      .send(png);
  } catch (error) {
    return next(error);
  }
};
