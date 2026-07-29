const MAX_DURATION_MINUTES = 10_080;

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMetric = (value) => Math.round(value * 100) / 100;

/**
 * Normalizes the workout payload to the subset that is safe to persist.
 * Older clients omitted `completed` and only submitted completed sets, so an
 * omitted flag remains backwards-compatible. An explicit false is never
 * counted.
 */
export const normalizeCompletedExercises = (
  exercises,
  { treatAllAsCompleted = false } = {}
) =>
  (Array.isArray(exercises) ? exercises : [])
    .map((exercise) => ({
      exerciseId: exercise.exerciseId?._id || exercise.exerciseId,
      exerciseName: exercise.exerciseName || exercise.exerciseId?.name || "",
      muscleGroup:
        exercise.muscleGroup || exercise.exerciseId?.muscleGroup || "",
      equipment: exercise.equipment || exercise.exerciseId?.equipment || "",
      sets: (Array.isArray(exercise.sets) ? exercise.sets : [])
        .filter((set) => treatAllAsCompleted || set.completed !== false)
        .map((set) => ({
          setType: set.setType || "normal",
          reps: toFiniteNumber(set.reps),
          weight: toFiniteNumber(set.weight),
          completed: true,
        })),
    }))
    .filter((exercise) => exercise.exerciseId && exercise.sets.length > 0);

export const calculateWorkoutMetrics = ({
  startTime,
  endTime,
  exercises,
  fallbackDurationMinutes = 0,
}) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const hasValidRange =
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end >= start;
  const calculatedDuration = hasValidRange
    ? Math.round((end.getTime() - start.getTime()) / 60_000)
    : Math.round(toFiniteNumber(fallbackDurationMinutes));
  const durationMinutes = Math.min(
    MAX_DURATION_MINUTES,
    Math.max(0, calculatedDuration)
  );

  let volumeKg = 0;
  let totalSets = 0;
  let totalReps = 0;

  for (const exercise of exercises || []) {
    for (const set of exercise.sets || []) {
      if (set.completed === false) continue;
      const reps = Math.max(0, toFiniteNumber(set.reps));
      const weight = Math.max(0, toFiniteNumber(set.weight));
      totalSets += 1;
      totalReps += reps;
      volumeKg += weight * reps;
    }
  }

  return {
    durationMinutes,
    volumeKg: roundMetric(volumeKg),
    totalSets,
    totalReps: roundMetric(totalReps),
  };
};

export const buildCanonicalWorkout = (workoutData, options = {}) => {
  const exercises = normalizeCompletedExercises(
    workoutData.exercises,
    options
  );
  const metrics = calculateWorkoutMetrics({
    startTime: workoutData.startTime,
    endTime: workoutData.endTime,
    exercises,
    fallbackDurationMinutes: workoutData.durationMinutes,
  });

  return {
    ...workoutData,
    exercises,
    ...metrics,
    metricsVersion: 2,
  };
};

export const calculateCurrentStreak = (dateKeys, now = new Date()) => {
  const availableDates = new Set(dateKeys || []);
  const cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);

  const toDateKey = (date) => date.toISOString().slice(0, 10);
  if (!availableDates.has(toDateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (availableDates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
};
