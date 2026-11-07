import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { createRoutine, updateRoutine } from "../../services/routineService.js";

/**
 * MM-PERF-04 (WP-15 of the 2026-11 audit): saving a routine costs a constant
 * number of inserts, not one per exercise and one per set inside the
 * transaction. Statements are counted at the driver.
 */
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];

const countingInserts = async <T>(run: () => Promise<T>): Promise<{ result: T; inserts: number }> => {
  const original = pg.Client.prototype.query;
  let inserts = 0;
  pg.Client.prototype.query = function counted(this: pg.Client, ...args: unknown[]) {
    const text = typeof args[0] === "string" ? args[0] : (args[0] as { text?: string } | undefined)?.text ?? "";
    if (/^insert into "routine_(exercises|sets)"/i.test(text.trim())) inserts += 1;
    return (original as (...values: unknown[]) => unknown).apply(this, args);
  } as typeof pg.Client.prototype.query;
  try {
    return { result: await run(), inserts };
  } finally {
    pg.Client.prototype.query = original;
  }
};

const exercises = (count: number, sets: number) => Array.from({ length: count }, (_, index) => ({
  exerciseId: null as unknown as string, exerciseName: `Exercise ${index}`, muscleGroup: "Chest", equipment: "Barbell",
  sets: Array.from({ length: sets }, (_, setIndex) => ({ reps: 10 - setIndex, weight: 20 + index + setIndex, setType: setIndex === 0 ? "warmup" as const : "normal" as const, completed: false })),
}));

test.before(async () => { await connectDatabase(); });
test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectDatabase();
});

test("a 10-exercise, 5-set routine is saved with two inserts and reads back unchanged", async () => {
  const user = await database.insertInto("users").values({ legacy_mongo_id: null, email: `routine-${runId}@example.test`, full_name: "routine member", username: `routine_${runId}`, password_hash: "x" }).returning("id").executeTakeFirstOrThrow();
  userIds.push(user.id);
  const input = exercises(10, 5);
  const { result: routine, inserts } = await countingInserts(() => createRoutine({ userId: user.id, operationId: randomUUID(), name: "Big routine", folder: "", exercises: input }));
  assert.ok(inserts <= 2, `${inserts} inserts for exercises and sets`);
  assert.equal(routine.exercises.length, 10);
  routine.exercises.forEach((exercise, index) => {
    assert.equal(exercise.exerciseName, `Exercise ${index}`);
    assert.equal(exercise.sets.length, 5);
    exercise.sets.forEach((set, setIndex) => {
      assert.equal(set.reps, 10 - setIndex);
      assert.equal(Number(set.weight), 20 + index + setIndex);
      assert.equal(set.setType, setIndex === 0 ? "warmup" : "normal");
    });
  });

  const { result: updated, inserts: updateInserts } = await countingInserts(() => updateRoutine(routine.id, user.id, { exercises: exercises(3, 2) }));
  assert.ok(updateInserts <= 2, `${updateInserts} inserts on update`);
  assert.equal(updated?.exercises.length, 3);
});
