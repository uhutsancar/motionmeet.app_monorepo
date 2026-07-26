import "dotenv/config";
import connectDB, { disconnectDB } from "../configs/db.js";
import Workout from "../models/Workout.js";
import User from "../models/User.js";
import { buildCanonicalWorkout } from "../utils/workoutMetrics.js";

const applyChanges = process.argv.includes("--apply");
const BATCH_SIZE = 250;

const flush = async (operations) => {
  if (!operations.length || !applyChanges) return;
  await Workout.bulkWrite(operations, { ordered: false });
  operations.length = 0;
};

const main = async () => {
  await connectDB();

  const operations = [];
  const totals = {
    scanned: 0,
    migrated: 0,
    totalDurationMinutes: 0,
    totalVolumeKg: 0,
    totalSets: 0,
    totalReps: 0,
  };

  for await (const workout of Workout.find({ metricsVersion: { $ne: 2 } })
    .select(
      "userId name startTime endTime durationMinutes volumeKg exercises metricsVersion"
    )
    .lean()
    .cursor()) {
    totals.scanned += 1;
    const canonical = buildCanonicalWorkout(workout, {
      // Legacy web clients only submitted completed sets but omitted the flag.
      // There is no reliable historical signal to distinguish those records.
      treatAllAsCompleted: true,
    });
    totals.migrated += 1;
    totals.totalDurationMinutes += canonical.durationMinutes;
    totals.totalVolumeKg += canonical.volumeKg;
    totals.totalSets += canonical.totalSets;
    totals.totalReps += canonical.totalReps;

    operations.push({
      updateOne: {
        filter: { _id: workout._id, metricsVersion: { $ne: 2 } },
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
    });

    if (operations.length >= BATCH_SIZE) await flush(operations);
  }
  await flush(operations);

  console.log(
    JSON.stringify(
      { mode: applyChanges ? "apply" : "dry-run", ...totals },
      null,
      2
    )
  );

  if (!applyChanges) {
    console.log(
      "Dry run complete. Re-run with --apply to migrate workouts and rebuild user statistics."
    );
    return;
  }

  const statistics = await Workout.aggregate([
    {
      $group: {
        _id: "$userId",
        totalWorkouts: { $sum: 1 },
        totalDurationMinutes: { $sum: "$durationMinutes" },
        totalVolumeKg: { $sum: "$volumeKg" },
      },
    },
  ]);

  await User.updateMany(
    {},
    {
      $set: {
        "statistics.totalWorkouts": 0,
        "statistics.totalDurationMinutes": 0,
        "statistics.totalVolumeKg": 0,
      },
    }
  );
  if (statistics.length) {
    await User.bulkWrite(
      statistics.map((entry) => ({
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
      })),
      { ordered: false }
    );
  }

  console.log("Workout metrics migration completed.");
};

try {
  await main();
} catch (error) {
  console.error("Workout metrics migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
