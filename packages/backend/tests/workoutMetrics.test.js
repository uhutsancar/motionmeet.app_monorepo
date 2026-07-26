import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalWorkout,
  calculateWorkoutMetrics,
  calculateCurrentStreak,
  normalizeCompletedExercises,
} from "../utils/workoutMetrics.js";

test("normalizes only completed sets and keeps legacy omitted flags", () => {
  const exercises = normalizeCompletedExercises([
    {
      exerciseId: "507f1f77bcf86cd799439011",
      sets: [
        { reps: "10", weight: "20", completed: true },
        { reps: 8, weight: 25, completed: false },
        { reps: 5, weight: 30 },
      ],
    },
  ]);

  assert.equal(exercises.length, 1);
  assert.deepEqual(
    exercises[0].sets.map(({ reps, weight, completed }) => ({
      reps,
      weight,
      completed,
    })),
    [
      { reps: 10, weight: 20, completed: true },
      { reps: 5, weight: 30, completed: true },
    ]
  );
});

test("calculates a streak that may continue from yesterday", () => {
  assert.equal(
    calculateCurrentStreak(
      ["2026-07-23", "2026-07-24", "2026-07-25"],
      new Date("2026-07-26T12:00:00.000Z")
    ),
    3
  );
  assert.equal(
    calculateCurrentStreak(
      ["2026-07-22", "2026-07-24"],
      new Date("2026-07-26T12:00:00.000Z")
    ),
    0
  );
});

test("derives duration, volume, sets and reps from canonical data", () => {
  const metrics = calculateWorkoutMetrics({
    startTime: "2026-07-26T10:00:00.000Z",
    endTime: "2026-07-26T10:45:00.000Z",
    exercises: [
      {
        sets: [
          { reps: 10, weight: 20, completed: true },
          { reps: 5, weight: 30, completed: true },
          { reps: 100, weight: 100, completed: false },
        ],
      },
    ],
  });

  assert.deepEqual(metrics, {
    durationMinutes: 45,
    volumeKg: 350,
    totalSets: 2,
    totalReps: 15,
  });
});

test("canonical workout ignores client supplied aggregate metrics", () => {
  const workout = buildCanonicalWorkout({
    name: "Test",
    startTime: "2026-07-26T10:00:00.000Z",
    endTime: "2026-07-26T10:30:00.000Z",
    durationMinutes: 999,
    volumeKg: 999_999,
    exercises: [
      {
        exerciseId: "507f1f77bcf86cd799439011",
        sets: [{ reps: 12, weight: 10, completed: true }],
      },
    ],
  });

  assert.equal(workout.durationMinutes, 30);
  assert.equal(workout.volumeKg, 120);
  assert.equal(workout.totalSets, 1);
  assert.equal(workout.metricsVersion, 2);
});
