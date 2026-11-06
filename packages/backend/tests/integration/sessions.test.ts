import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { isSessionActive } from "../../utils/authTokens.js";

test.before(connectDatabase);
test.after(disconnectDatabase);

test("P1-SOCKET-003: a socket's session counts only while it is unrevoked, unexpired and its owner's", async () => {
  const runId = randomUUID().slice(0, 8);
  const [owner, other] = await Promise.all(["owner", "other"].map((name) => database.insertInto("users")
    .values({ legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: name, username: `${name}_${runId}`, password_hash: "test-hash" })
    .returning("id").executeTakeFirstOrThrow()));
  try {
    const live = await database.insertInto("sessions").values({ user_id: owner!.id, token_hash: `live-${runId}`, expires_at: new Date(Date.now() + 86_400_000), revoked_at: null }).returning("id").executeTakeFirstOrThrow();
    const expired = await database.insertInto("sessions").values({ user_id: owner!.id, token_hash: `expired-${runId}`, expires_at: new Date(Date.now() - 1_000), revoked_at: null }).returning("id").executeTakeFirstOrThrow();

    assert.equal(await isSessionActive(live.id, owner!.id), true);
    assert.equal(await isSessionActive(live.id, other!.id), false, "another member's token cannot borrow the session");
    assert.equal(await isSessionActive(expired.id, owner!.id), false);
    assert.equal(await isSessionActive(randomUUID(), owner!.id), false);

    await database.updateTable("sessions").set({ revoked_at: new Date() }).where("id", "=", live.id).execute();
    assert.equal(await isSessionActive(live.id, owner!.id), false, "logout revokes it");
  } finally {
    await database.deleteFrom("users").where("id", "in", [owner!.id, other!.id]).execute();
  }
});
