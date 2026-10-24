import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { createMessage, deleteMessageById, getMessageById, getUserConversationsList } from "../../services/messageService.js";

/*
 * Deleting the newest message of a thread must hand the inbox the message
 * before it. The conversation's pointer used to be read after the delete, when
 * the foreign key had already nulled it, and the thread fell out of both
 * members' inboxes while its other messages were still stored.
 */
test("deleting a thread's newest message keeps the thread in the inbox", { timeout: 60_000 }, async () => {
  await connectDatabase();
  const runId = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  try {
    const sender = await database.insertInto("users").values({ legacy_mongo_id: null, email: `del-sender-${runId}@example.test`, full_name: "Delete Sender", username: `del_sender_${runId}`, password_hash: "test-hash" }).returning("id").executeTakeFirstOrThrow();
    const recipient = await database.insertInto("users").values({ legacy_mongo_id: null, email: `del-recipient-${runId}@example.test`, full_name: "Delete Recipient", username: `del_recipient_${runId}`, password_hash: "test-hash" }).returning("id").executeTakeFirstOrThrow();
    userIds.push(sender.id, recipient.id);

    const first = await createMessage({ from_user_id: sender.id, to_user_id: recipient.id, operationId: `first-${runId}`, text: "first", message_type: "text", media_url: "", media_key: "" });
    const second = await createMessage({ from_user_id: sender.id, to_user_id: recipient.id, operationId: `second-${runId}`, text: "second", message_type: "text", media_url: "", media_key: "" });

    const access = await getMessageById(second.id);
    assert.ok(access);
    await deleteMessageById(access);

    for (const userId of [sender.id, recipient.id]) {
      const { items } = await getUserConversationsList(userId, { limit: 20, cursor: null, rawCursor: null });
      assert.equal(items.length, 1, "the thread is still listed");
      assert.equal(items[0]?.lastMessage.id, first.id, "the earlier message is now the last one");
    }

    // Removing the only remaining message empties the thread without error.
    const firstAccess = await getMessageById(first.id);
    assert.ok(firstAccess);
    await deleteMessageById(firstAccess);
    const { items: afterAll } = await getUserConversationsList(sender.id, { limit: 20, cursor: null, rawCursor: null });
    assert.equal(afterAll.length, 0);
  } finally {
    if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
    await disconnectDatabase();
  }
});
