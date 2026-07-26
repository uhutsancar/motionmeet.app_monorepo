import mongoose from "mongoose";

const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const isObjectId = (value) =>
  typeof value === "string" && mongoose.isObjectIdOrHexString(value);

export const isUserId = (value) =>
  typeof value === "string" && USER_ID_PATTERN.test(value);

export const isNonEmptyString = (value, maxLength = 255) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;

export const isOptionalString = (value, maxLength = 255) =>
  value === undefined || value === null || (typeof value === "string" && value.trim().length <= maxLength);

export const isOptionalHttpUrl = (value, maxLength = 2048) => {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string" || value.trim().length > maxLength) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" && parsed.protocol === "http:");
  } catch {
    return false;
  }
};

export const isFiniteNumber = (value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return false;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};

export const isExerciseList = (value, { allowEmpty = false } = {}) => {
  if (!Array.isArray(value) || value.length > 50 || (!allowEmpty && value.length === 0)) {
    return false;
  }

  return value.every((exercise) => {
    if (!exercise || typeof exercise !== "object" || !isObjectId(exercise.exerciseId)) {
      return false;
    }

    if (!Array.isArray(exercise.sets) || exercise.sets.length > 30) {
      return false;
    }

    return exercise.sets.every((set) => {
      if (!set || typeof set !== "object") return false;
      if (set.setType !== undefined && !["normal", "warmup", "drop", "failure"].includes(set.setType)) {
        return false;
      }

      return (
        (set.reps === undefined ||
          (isFiniteNumber(set.reps, { min: 0, max: 10000 }) &&
            Number.isInteger(Number(set.reps)))) &&
        (set.weight === undefined || isFiniteNumber(set.weight, { min: 0, max: 100000 })) &&
        (set.completed === undefined || typeof set.completed === "boolean")
      );
    });
  });
};
