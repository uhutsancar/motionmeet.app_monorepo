import type { RequestHandler } from "express";
import { isUuid } from "../utils/validation.js";
import * as measurementService from "../services/measurementService.js";
import { MEASUREMENT_COLUMNS, type MeasurementColumn } from "../services/measurementService.js";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_MAX_LENGTH = 500;

/** Body-fat is a percentage; everything else is a kg/cm figure. */
const LIMITS: Record<MeasurementColumn, { min: number; max: number }> = {
  weight_kg: { min: 20, max: 500 },
  body_fat_percentage: { min: 1, max: 75 },
  waist_cm: { min: 20, max: 300 },
  chest_cm: { min: 20, max: 300 },
  hips_cm: { min: 20, max: 300 },
  neck_cm: { min: 10, max: 120 },
  shoulders_cm: { min: 20, max: 300 },
  left_arm_cm: { min: 10, max: 150 },
  right_arm_cm: { min: 10, max: 150 },
  left_thigh_cm: { min: 10, max: 200 },
  right_thigh_cm: { min: 10, max: 200 },
};

const BODY_KEYS: Record<MeasurementColumn, string> = {
  weight_kg: "weightKg",
  body_fat_percentage: "bodyFatPercentage",
  waist_cm: "waistCm",
  chest_cm: "chestCm",
  hips_cm: "hipsCm",
  neck_cm: "neckCm",
  shoulders_cm: "shouldersCm",
  left_arm_cm: "leftArmCm",
  right_arm_cm: "rightArmCm",
  left_thigh_cm: "leftThighCm",
  right_thigh_cm: "rightThighCm",
};

/** A calendar day is only valid if PostgreSQL would accept it as-is. */
const isValidDay = (value: unknown): value is string => {
  if (typeof value !== "string" || !DAY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const listMyMeasurements: RequestHandler = async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit);
    const measurements = await measurementService.listMeasurements(
      req.userId,
      Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.trunc(requestedLimit) : undefined,
    );
    res.status(200).json({ success: true, measurements });
  } catch (error) {
    next(error);
  }
};

export const saveMyMeasurement: RequestHandler = async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const measuredOn = body.measuredOn ?? new Date().toISOString().slice(0, 10);

    if (!isValidDay(measuredOn)) {
      return res.status(400).json({ success: false, message: "measuredOn must be a YYYY-MM-DD date" });
    }
    if (measuredOn > new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ success: false, message: "measuredOn cannot be in the future" });
    }

    const note = body.note === undefined || body.note === null ? "" : body.note;
    if (typeof note !== "string" || note.length > NOTE_MAX_LENGTH) {
      return res.status(400).json({ success: false, message: `note must be a string of at most ${NOTE_MAX_LENGTH} characters` });
    }

    const values: measurementService.MeasurementValues = {};
    let providedCount = 0;

    for (const column of MEASUREMENT_COLUMNS) {
      const raw = body[BODY_KEYS[column]];
      if (raw === undefined || raw === null || raw === "") {
        values[column] = null;
        continue;
      }
      const parsed = Number(raw);
      const { min, max } = LIMITS[column];
      if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        return res.status(400).json({ success: false, message: `${BODY_KEYS[column]} must be between ${min} and ${max}` });
      }
      // Two decimals is what the numeric columns store; rounding here keeps the
      // saved value identical to what the client will read back.
      values[column] = Math.round(parsed * 100) / 100;
      providedCount += 1;
    }

    if (providedCount === 0) {
      return res.status(400).json({ success: false, message: "At least one measurement value is required" });
    }

    const measurement = await measurementService.saveMeasurement(req.userId, {
      measuredOn,
      note: note.trim(),
      ...values,
    });

    res.status(200).json({ success: true, measurement });
  } catch (error) {
    next(error);
  }
};

export const deleteMyMeasurement: RequestHandler = async (req, res, next) => {
  try {
    const { measurementId } = req.params;
    if (!isUuid(measurementId)) {
      return res.status(400).json({ success: false, message: "Invalid measurement id" });
    }

    const deleted = await measurementService.deleteMeasurement(req.userId, measurementId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Measurement not found" });
    }

    res.status(200).json({ success: true, message: "Measurement deleted" });
  } catch (error) {
    next(error);
  }
};
