export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);
export const isUserId = isUuid;
export const isNonEmptyString = (value: unknown, maxLength = 255): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
export const isOptionalString = (value: unknown, maxLength = 255): value is string | null | undefined =>
  value === undefined || value === null || (typeof value === "string" && value.trim().length <= maxLength);
export const isOptionalHttpUrl = (value: unknown, maxLength = 2048): value is string | null | undefined => {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string" || value.trim().length > maxLength) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || (process.env.NODE_ENV !== "production" && parsed.protocol === "http:");
  } catch { return false; }
};
export const isFiniteNumber = (value: unknown, { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {}): boolean => {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && value.trim() === "")) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};

export interface ExerciseSetInput { setType?: "normal" | "warmup" | "drop" | "failure"; reps?: number; weight?: number; completed?: boolean }
export interface ExerciseInput { exerciseId: string; sets: ExerciseSetInput[] }

export const isExerciseList = (value: unknown, { allowEmpty = false }: { allowEmpty?: boolean } = {}): value is ExerciseInput[] => {
  if (!Array.isArray(value) || value.length > 50 || (!allowEmpty && value.length === 0)) return false;
  return value.every((candidate: unknown) => {
    if (!candidate || typeof candidate !== "object") return false;
    const exercise = candidate as { exerciseId?: unknown; sets?: unknown };
    if (!isUuid(exercise.exerciseId) || !Array.isArray(exercise.sets) || exercise.sets.length > 30) return false;
    return exercise.sets.every((setCandidate: unknown) => {
      if (!setCandidate || typeof setCandidate !== "object") return false;
      const set = setCandidate as { setType?: unknown; reps?: unknown; weight?: unknown; completed?: unknown };
      if (set.setType !== undefined && (typeof set.setType !== "string" || !["normal", "warmup", "drop", "failure"].includes(set.setType))) return false;
      return (set.reps === undefined || (isFiniteNumber(set.reps, { min: 0, max: 10_000 }) && Number.isInteger(Number(set.reps)))) &&
        (set.weight === undefined || isFiniteNumber(set.weight, { min: 0, max: 100_000 })) &&
        (set.completed === undefined || typeof set.completed === "boolean");
    });
  });
};
