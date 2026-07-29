import PersonalRecord from "../models/PersonalRecord.js";
import UserDailyWorkoutStat from "../models/UserDailyWorkoutStat.js";
import UserExerciseDailyStat from "../models/UserExerciseDailyStat.js";

const MUSCLE_MAP = {
  chest: "chest",
  back: "back",
  lats: "back",
  "lower back": "back",
  legs: "legs",
  quadriceps: "legs",
  hamstrings: "legs",
  calves: "legs",
  glutes: "legs",
  shoulders: "shoulders",
  arms: "arms",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  abs: "abs",
  abdominals: "abs",
  core: "abs",
  cardio: "cardio",
  "full body": "full_body",
};

const dateKeyFor = (value) => new Date(value).toISOString().slice(0, 10);

const exerciseMetrics = (exercise) => {
  let totalVolumeKg = 0;
  let totalReps = 0;
  let totalSets = 0;
  let maxWeight = 0;
  let recordReps = 0;
  for (const set of exercise.sets || []) {
    if (set.completed === false) continue;
    const weight = Math.max(0, Number(set.weight) || 0);
    const reps = Math.max(0, Number(set.reps) || 0);
    totalVolumeKg += weight * reps;
    totalReps += reps;
    totalSets += 1;
    if (weight > maxWeight) {
      maxWeight = weight;
      recordReps = reps;
    }
  }
  return { totalVolumeKg, totalReps, totalSets, maxWeight, recordReps };
};

/**
 * @param {any} workout
 * @param {{session?: import("mongoose").ClientSession | null}} [options]
 */
export const applyWorkoutAnalytics = async (
  workout,
  { session = null } = {}
) => {
  const workoutDate = new Date(workout.startTime || workout.createdAt);
  const dateKey = dateKeyFor(workoutDate);
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const muscleSets = {};
  const exercises = [];

  for (const exercise of workout.exercises || []) {
    const metrics = exerciseMetrics(exercise);
    if (!metrics.totalSets) continue;
    const normalizedMuscle =
      MUSCLE_MAP[String(exercise.muscleGroup || "").toLowerCase()] ||
      String(exercise.muscleGroup || "").toLowerCase();
    if (normalizedMuscle) {
      muscleSets[normalizedMuscle] =
        (muscleSets[normalizedMuscle] || 0) + metrics.totalSets;
    }
    exercises.push({ exercise, metrics });
  }

  const dailyIncrement = {
    totalWorkouts: 1,
    totalDurationMinutes: Number(workout.durationMinutes || 0),
    totalVolumeKg: Number(workout.volumeKg || 0),
    totalSets: Number(workout.totalSets || 0),
    totalReps: Number(workout.totalReps || 0),
  };
  for (const [muscle, count] of Object.entries(muscleSets)) {
    dailyIncrement[`muscleSets.${muscle}`] = count;
  }
  await UserDailyWorkoutStat.updateOne(
    { userId: workout.userId, dateKey },
    {
      $setOnInsert: { userId: workout.userId, dateKey, date },
      $inc: dailyIncrement,
    },
    { upsert: true, session }
  );

  if (exercises.length) {
    await UserExerciseDailyStat.bulkWrite(
      exercises.map(({ exercise, metrics }) => ({
        updateOne: {
          filter: {
            userId: workout.userId,
            dateKey,
            exerciseId: exercise.exerciseId,
          },
          update: {
            $setOnInsert: {
              userId: workout.userId,
              dateKey,
              date,
              exerciseId: exercise.exerciseId,
            },
            $set: {
              exerciseName: exercise.exerciseName || "Exercise",
              muscleGroup: exercise.muscleGroup || "",
            },
            $inc: {
              totalVolumeKg: metrics.totalVolumeKg,
              totalReps: metrics.totalReps,
              totalSets: metrics.totalSets,
              totalSessions: 1,
            },
            $max: { maxWeight: metrics.maxWeight },
          },
          upsert: true,
        },
      })),
      { session, ordered: true }
    );

    await PersonalRecord.bulkWrite(
      exercises.map(({ exercise, metrics }) => {
        const fallbackName = exercise.exerciseName || "Exercise";
        const isNewRecord = {
          $gt: [metrics.maxWeight, { $ifNull: ["$value", -1] }],
        };
        return {
          updateOne: {
            filter: {
              userId: workout.userId,
              exerciseId: exercise.exerciseId,
            },
            update: [
              {
                $set: {
                  userId: workout.userId,
                  exerciseId: exercise.exerciseId,
                  exerciseName: {
                    $cond: [
                      isNewRecord,
                      fallbackName,
                      { $ifNull: ["$exerciseName", fallbackName] },
                    ],
                  },
                  value: {
                    $cond: [
                      isNewRecord,
                      metrics.maxWeight,
                      { $ifNull: ["$value", 0] },
                    ],
                  },
                  reps: {
                    $cond: [
                      isNewRecord,
                      metrics.recordReps,
                      { $ifNull: ["$reps", 0] },
                    ],
                  },
                  recordedAt: {
                    $cond: [
                      isNewRecord,
                      workoutDate,
                      { $ifNull: ["$recordedAt", workoutDate] },
                    ],
                  },
                  workoutId: {
                    $cond: [
                      isNewRecord,
                      workout._id,
                      { $ifNull: ["$workoutId", workout._id] },
                    ],
                  },
                },
              },
            ],
            upsert: true,
          },
        };
      }),
      { session, ordered: true }
    );
  }
};

const getCurrentStreak = async (userId, now) => {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  let expected = null;
  let streak = 0;

  for await (const entry of UserDailyWorkoutStat.find({
    userId,
    date: { $lte: today },
  })
    .select("dateKey")
    .sort({ date: -1, _id: -1 })
    .lean()
    .cursor()) {
    if (!expected) {
      if (entry.dateKey === dateKeyFor(today)) expected = today;
      else if (entry.dateKey === dateKeyFor(yesterday)) expected = yesterday;
      else break;
    }
    if (entry.dateKey !== dateKeyFor(expected)) break;
    streak += 1;
    expected.setUTCDate(expected.getUTCDate() - 1);
  }
  return streak;
};

export const getComputedWorkoutStats = async (userId, period) => {
  const now = new Date();
  const isMonthly = period === "month" || period === "calendar_month";
  const cutoff =
    period === "calendar_month"
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      : new Date(now);
  if (period !== "calendar_month") {
    const windowDays = period === "week" ? 7 : period === "month" ? 30 : 365;
    cutoff.setUTCDate(cutoff.getUTCDate() - windowDays + 1);
    cutoff.setUTCHours(0, 0, 0, 0);
  }

  const daily = await UserDailyWorkoutStat.find({
    userId,
    date: { $gte: cutoff, $lte: now },
  })
    .sort({ date: 1, _id: 1 })
    .lean();

  const grouped = new Map();
  const muscleTotals = {};
  for (const entry of daily) {
    const date = new Date(entry.date);
    const key =
      period === "year"
        ? date.toISOString().slice(0, 7)
        : date.toISOString().slice(0, 10);
    const existing = grouped.get(key) || {
      label:
        period === "year"
          ? date.toLocaleDateString("en-US", {
              month: "short",
              timeZone: "UTC",
              year: "2-digit",
            })
          : date.toLocaleDateString("en-US", {
              day: isMonthly ? "numeric" : undefined,
              month: isMonthly ? "short" : undefined,
              timeZone: "UTC",
              weekday: isMonthly ? undefined : "short",
            }),
      volume: 0,
      duration: 0,
      reps: 0,
      sets: 0,
      workouts: 0,
    };
    existing.volume += entry.totalVolumeKg || 0;
    existing.duration += entry.totalDurationMinutes || 0;
    existing.reps += entry.totalReps || 0;
    existing.sets += entry.totalSets || 0;
    existing.workouts += entry.totalWorkouts || 0;
    grouped.set(key, existing);

    const muscleEntries =
      entry.muscleSets instanceof Map
        ? [...entry.muscleSets.entries()]
        : Object.entries(entry.muscleSets || {});
    for (const [muscle, count] of muscleEntries) {
      muscleTotals[muscle] = (muscleTotals[muscle] || 0) + Number(count || 0);
    }
  }

  const exerciseBreakdown = await UserExerciseDailyStat.aggregate([
    { $match: { userId, date: { $gte: cutoff, $lte: now } } },
    {
      $group: {
        _id: "$exerciseId",
        name: { $last: "$exerciseName" },
        volume: { $sum: "$totalVolumeKg" },
        reps: { $sum: "$totalReps" },
        sets: { $sum: "$totalSets" },
      },
    },
    { $sort: { volume: -1, _id: 1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        name: 1,
        volume: 1,
        reps: 1,
        sets: 1,
        total: { $round: ["$volume", 0] },
      },
    },
  ]).allowDiskUse(true);

  const muscleSetCount = Object.values(muscleTotals).reduce(
    (sum, count) => sum + count,
    0
  );
  const muscleDistribution = Object.fromEntries(
    Object.entries(muscleTotals).map(([muscle, count]) => [
      muscle,
      muscleSetCount ? Number((count / muscleSetCount).toFixed(3)) : 0,
    ])
  );
  const dates = [...grouped.keys()];
  const values = [...grouped.values()];
  return {
    stats: {
      labels: values.map((entry) => entry.label),
      dates,
      volumes: values.map((entry) => Math.round(entry.volume)),
      durations: values.map((entry) => entry.duration),
      reps: values.map((entry) => entry.reps),
      sets: values.map((entry) => entry.sets),
      workouts: values.map((entry) => entry.workouts),
    },
    exerciseBreakdown,
    muscleDistribution,
    totalVolume: Math.round(
      daily.reduce((sum, entry) => sum + (entry.totalVolumeKg || 0), 0)
    ),
    totalDuration: daily.reduce(
      (sum, entry) => sum + (entry.totalDurationMinutes || 0),
      0
    ),
    totalWorkouts: daily.reduce(
      (sum, entry) => sum + (entry.totalWorkouts || 0),
      0
    ),
    totalSets: daily.reduce(
      (sum, entry) => sum + (entry.totalSets || 0),
      0
    ),
    workoutDates: daily.map((entry) => entry.dateKey),
    currentStreakDays: await getCurrentStreak(userId, now),
  };
};

export const getComputedExerciseStats = async (exerciseId, userId) => {
  const [record, history, sessionTotals] = await Promise.all([
    PersonalRecord.findOne({ userId, exerciseId }).select("value").lean(),
    UserExerciseDailyStat.find({ userId, exerciseId })
      .select("date maxWeight totalVolumeKg")
      .sort({ date: -1, _id: -1 })
      .limit(365)
      .lean(),
    UserExerciseDailyStat.aggregate([
      { $match: { userId, exerciseId } },
      { $group: { _id: null, total: { $sum: "$totalSessions" } } },
    ]),
  ]);
  return {
    personalRecord: record?.value || 0,
    totalSessions: sessionTotals[0]?.total || 0,
    history: history
      .map((entry) => ({
        date: entry.date,
        maxWeight: entry.maxWeight,
        volume: entry.totalVolumeKg,
      }))
      .reverse(),
  };
};

export const getComputedPersonalRecords = async (userId, limit = 50) => {
  return PersonalRecord.find({ userId })
    .select("-userId -createdAt -updatedAt -__v")
    .sort({ value: -1, recordedAt: -1, _id: -1 })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 100))
    .lean();
};
