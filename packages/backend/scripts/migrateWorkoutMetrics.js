import "dotenv/config";
import connectDB, { disconnectDB } from "../configs/db.js";
import Exercise from "../models/Exercise.js";
import User from "../models/User.js";
import Workout from "../models/Workout.js";
import PersonalRecord from "../models/PersonalRecord.js";
import UserDailyWorkoutStat from "../models/UserDailyWorkoutStat.js";
import UserExerciseDailyStat from "../models/UserExerciseDailyStat.js";
import { buildCanonicalWorkout } from "../utils/workoutMetrics.js";
import { applyWorkoutAnalytics } from "../services/workoutAnalyticsService.js";

const apply = process.argv.includes("--apply");
process.env.MONGODB_MAX_TIME_MS ||= "600000";
const BATCH_SIZE = 250;

const needsMigration = {
  $or: [
    { metricsVersion: { $ne: 2 } },
    { "exercises.exerciseName": { $in: [null, ""] } },
  ],
};

const migrateBatch = async (workouts) => {
  const exerciseIds = [
    ...new Set(
      workouts.flatMap((workout) =>
        (workout.exercises || []).map((exercise) =>
          String(exercise.exerciseId?._id || exercise.exerciseId)
        )
      )
    ),
  ];
  const exercises = await Exercise.find({ _id: { $in: exerciseIds } })
    .select("name muscleGroup equipment")
    .lean();
  const exerciseById = new Map(
    exercises.map((exercise) => [exercise._id.toString(), exercise])
  );

  const operations = workouts.map((workout) => {
    const sourceExercises = (workout.exercises || []).map((exercise) => {
      const exerciseId = exercise.exerciseId?._id || exercise.exerciseId;
      const snapshot = exerciseById.get(String(exerciseId));
      return {
        exerciseId,
        exerciseName:
          exercise.exerciseName || snapshot?.name || "Deleted exercise",
        muscleGroup: exercise.muscleGroup || snapshot?.muscleGroup || "",
        equipment: exercise.equipment || snapshot?.equipment || "",
        sets: exercise.sets || [],
      };
    });
    const canonical = buildCanonicalWorkout(
      {
        startTime: workout.startTime,
        endTime: workout.endTime,
        durationMinutes: workout.durationMinutes,
        exercises: sourceExercises,
      },
      { treatAllAsCompleted: workout.metricsVersion !== 2 }
    );
    return {
      updateOne: {
        filter: { _id: workout._id },
        update: {
          $set: {
            exercises: canonical.exercises,
            durationMinutes: canonical.durationMinutes,
            volumeKg: canonical.volumeKg,
            totalSets: canonical.totalSets,
            totalReps: canonical.totalReps,
            metricsVersion: 2,
          },
        },
      },
    };
  });
  if (operations.length) await Workout.bulkWrite(operations);
};

const reconcileUserStatistics = async () => {
  await User.updateMany(
    {},
    {
      $set: {
        statistics: {
          totalWorkouts: 0,
          totalDurationMinutes: 0,
          totalVolumeKg: 0,
        },
      },
    }
  );
  const aggregates = await Workout.aggregate([
    {
      $group: {
        _id: "$userId",
        totalWorkouts: { $sum: 1 },
        totalDurationMinutes: { $sum: "$durationMinutes" },
        totalVolumeKg: { $sum: "$volumeKg" },
      },
    },
  ]).allowDiskUse(true);
  if (aggregates.length) {
    await User.bulkWrite(
      aggregates.map((entry) => ({
        updateOne: {
          filter: { _id: entry._id },
          update: {
            $set: {
              "statistics.totalWorkouts": entry.totalWorkouts,
              "statistics.totalDurationMinutes": entry.totalDurationMinutes,
              "statistics.totalVolumeKg": entry.totalVolumeKg,
            },
          },
        },
      }))
    );
  }
};

const rebuildComputedAnalytics = async () => {
  await Promise.all([
    PersonalRecord.deleteMany({}),
    UserDailyWorkoutStat.deleteMany({}),
    UserExerciseDailyStat.deleteMany({}),
  ]);
  for await (const workout of Workout.find({})
    .select(
      "userId startTime createdAt durationMinutes volumeKg totalSets totalReps exercises"
    )
    .lean()
    .cursor()) {
    await applyWorkoutAnalytics(workout);
  }
};

try {
  await connectDB();
  const count = await Workout.countDocuments(needsMigration);
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        workoutsNeedingMigration: count,
      },
      null,
      2
    )
  );

  if (apply && count > 0) {
    let batch = [];
    for await (const workout of Workout.find(needsMigration).lean().cursor()) {
      batch.push(workout);
      if (batch.length === BATCH_SIZE) {
        await migrateBatch(batch);
        batch = [];
      }
    }
    if (batch.length) await migrateBatch(batch);
  }
  if (apply) {
    await reconcileUserStatistics();
    await rebuildComputedAnalytics();
  }
} catch (error) {
  console.error("Workout metrics migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
