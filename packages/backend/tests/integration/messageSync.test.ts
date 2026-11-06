import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { sql } from "kysely";
import type { MessageSyncResult } from "@motionmeet/shared";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { conversationPairKey, createMessage, deleteMessageById, getMessageById, markMessagesSeen, purgeMessageTombstones, syncConversationMessages } from "../../services/messageService.js";
import { deleteAccountData } from "../../services/accountService.js";
import { backfillMessageSequence } from "../../db/migrations/016_message_sync.js";

/**
 * Message synchronisation (WP-05 of the 2026-11 audit, ADR 005) against a
 * real PostgreSQL: sequence numbers in commit order, deletions as tombstones,
 * one paging boundary for both, and every case in which a client's cursor can
 * no longer be continued.
 */
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];
const newUser = async (name: string): Promise<string> => {
  const row = await database.insertInto("users").values({
    legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: `${name} member`, username: `${name}_${runId}`, password_hash: "test-hash",
  }).returning("id").executeTakeFirstOrThrow();
  userIds.push(row.id);
  return row.id;
};
const send = (from: string, to: string, text = "hi") =>
  createMessage({ from_user_id: from, to_user_id: to, operationId: randomUUID(), text, message_type: "text", media_url: "", media_key: "" });
const sync = (userId: string, partnerId: string, afterSeq: number, options: { conversationId?: string | null; limit?: number } = {}): Promise<MessageSyncResult> =>
  syncConversationMessages(userId, partnerId, { afterSeq, conversationId: options.conversationId ?? null, limit: options.limit ?? 100 });
const conversationOf = async (left: string, right: string) =>
  database.selectFrom("conversations").selectAll().where("pair_key", "=", conversationPairKey(left, right)).executeTakeFirstOrThrow();
/** Bulk messages through SQL: the trigger numbers each row exactly as for the API. */
const bulkSend = async (from: string, to: string, count: number): Promise<void> => {
  await send(from, to, "first");
  const conversation = await conversationOf(from, to);
  await sql`insert into messages (conversation_id, from_user_id, to_user_id, text, message_type)
    select ${conversation.id}::uuid, ${from}::uuid, ${to}::uuid, 'bulk ' || g, 'text' from generate_series(2, ${count}) g`.execute(database);
};

/** Follows `nextAfterSeq` until the end, the way a client does. */
const drain = async (userId: string, partnerId: string, afterSeq: number, limit: number) => {
  const messages = new Map<string, number>();
  const deletions = new Map<string, number>();
  let cursor = afterSeq;
  let requests = 0;
  for (;;) {
    const page = await sync(userId, partnerId, cursor, { limit });
    requests += 1;
    assert.equal(page.resyncRequired, false);
    for (const message of page.messages) messages.set(message.id, (messages.get(message.id) ?? 0) + 1);
    for (const id of page.deletedMessageIds) deletions.set(id, (deletions.get(id) ?? 0) + 1);
    assert.ok(page.nextAfterSeq >= cursor, "the cursor never moves backwards");
    cursor = page.nextAfterSeq;
    if (!page.hasMore) return { messages, deletions, cursor, requests };
  }
};

test.before(async () => { await connectDatabase(); });
test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectDatabase();
});

test("a created message carries its sequence number", async () => {
  const a = await newUser("seqa"); const b = await newUser("seqb");
  const first = await send(a, b); const second = await send(b, a);
  assert.equal(first.seq, 1);
  assert.equal(second.seq, 2);
});

test("seq follows commit order under contention: a reader syncing during parallel writes misses nothing", async () => {
  const a = await newUser("conta"); const b = await newUser("contb");
  await send(a, b, "opening");
  const writers = Promise.all(Array.from({ length: 40 }, (_, index) => send(index % 2 ? a : b, index % 2 ? b : a, `parallel ${index}`)));
  const seen = new Map<string, number>();
  let cursor = 0;
  let writing = true;
  void writers.finally(() => { writing = false; });
  while (writing) {
    const page = await sync(b, a, cursor, { limit: 7 });
    for (const message of page.messages) seen.set(message.id, (seen.get(message.id) ?? 0) + 1);
    cursor = page.nextAfterSeq;
  }
  const created = await writers;
  const rest = await drain(b, a, cursor, 7);
  for (const [id, count] of rest.messages) seen.set(id, (seen.get(id) ?? 0) + count);
  const seqs = created.map((message) => message.seq);
  assert.equal(new Set(seqs).size, seqs.length, "sequence numbers are unique");
  assert.equal(seen.size, 41, "every message reached the syncing reader");
  assert.ok([...seen.values()].every((count) => count === 1), "and none of them twice");
});

test("200 missed messages arrive in pages of 100, none twice, none skipped", async () => {
  const a = await newUser("pagea"); const b = await newUser("pageb");
  await bulkSend(a, b, 200);
  const first = await sync(b, a, 0, { limit: 100 });
  assert.equal(first.messages.length, 100);
  assert.equal(first.hasMore, true);
  assert.equal(first.latestSeq, 200);
  // Why the cursor is nextAfterSeq and never latestSeq: continuing from
  // latestSeq here would silently drop messages 101-200.
  assert.equal((await sync(b, a, first.latestSeq, { limit: 100 })).messages.length, 0);
  const all = await drain(b, a, 0, 100);
  // Each page reads one event past its limit to know whether there is more,
  // so 200 events take two requests rather than two full ones and an empty third.
  assert.equal(all.requests, 2);
  assert.equal(all.messages.size, 200);
  assert.ok([...all.messages.values()].every((count) => count === 1));
  assert.equal(all.cursor, 200);
  const third = await sync(b, a, all.cursor, { limit: 100 });
  assert.deepEqual([third.messages.length, third.deletedMessageIds.length, third.hasMore, third.nextAfterSeq], [0, 0, false, 200]);
});

test("messages and deletions share one paging boundary", async () => {
  const a = await newUser("mixa"); const b = await newUser("mixb");
  const deleted: string[] = [];
  for (let round = 0; round < 3; round += 1) {
    const batch = await Promise.all(Array.from({ length: 50 }, (_, index) => send(a, b, `r${round} m${index}`)));
    const victims = batch.filter((_, index) => index % 5 === 0).map((message) => message.id);
    await database.deleteFrom("messages").where("id", "in", victims).execute();
    deleted.push(...victims);
  }
  const all = await drain(b, a, 0, 50);
  assert.equal(all.messages.size, 120, "every surviving message exactly once");
  assert.ok([...all.messages.values()].every((count) => count === 1));
  assert.equal(all.deletions.size, 30, "every deletion exactly once");
  assert.ok([...all.deletions.values()].every((count) => count === 1));
  for (const id of deleted) assert.ok(!all.messages.has(id), "a deleted message is never delivered as a message");
});

test("a message sent and deleted while the client was away arrives only as a deletion", async () => {
  const a = await newUser("gonea"); const b = await newUser("goneb");
  await send(a, b);
  const cursor = (await sync(b, a, 0)).nextAfterSeq;
  const passing = await send(a, b, "oops");
  await deleteMessageById((await getMessageById(passing.id))!);
  const page = await sync(b, a, cursor);
  assert.deepEqual(page.messages, []);
  assert.deepEqual(page.deletedMessageIds, [passing.id]);
});

test("a delete outside the application code still leaves a tombstone", async () => {
  const a = await newUser("lega"); const b = await newUser("legb");
  await send(a, b, "keep");
  const doomed = await send(a, b, "legacy delete");
  // The previous release deletes rows itself; the trigger must cover it.
  await database.deleteFrom("messages").where("id", "=", doomed.id).execute();
  const tombstone = await database.selectFrom("message_deletions").selectAll().where("message_id", "=", doomed.id).executeTakeFirst();
  assert.ok(tombstone);
  assert.equal(Number(tombstone.change_seq), 3);
});

test("deleting the last message, or an account, ends in conversationGone rather than an error", async () => {
  const a = await newUser("lasta"); const b = await newUser("lastb");
  const only = await send(a, b);
  await deleteMessageById((await getMessageById(only.id))!);
  const afterDelete = await sync(b, a, 1);
  assert.equal(afterDelete.conversationGone, true);
  assert.equal(afterDelete.resyncRequired, false);

  const c = await newUser("lastc"); const d = await newUser("lastd");
  await send(c, d);
  await deleteAccountData(c); userIds.splice(userIds.indexOf(c), 1);
  assert.equal((await sync(d, c, 1)).conversationGone, true);
});

test("a conversation deleted and started again forces a resync", async () => {
  const a = await newUser("reca"); const b = await newUser("recb");
  const first = await send(a, b);
  await deleteMessageById((await getMessageById(first.id))!);
  const again = await send(a, b, "new thread");
  assert.notEqual(again.conversationId, first.conversationId);
  assert.equal(again.seq, 1, "numbering restarts with the new conversation");
  const page = await sync(b, a, 1, { conversationId: first.conversationId });
  assert.equal(page.resyncRequired, true);
  assert.equal(page.conversationId, again.conversationId);
  assert.deepEqual(page.messages, []);
});

test("a cursor beyond the conversation's newest position forces a resync", async () => {
  const a = await newUser("aheada"); const b = await newUser("aheadb");
  await send(a, b);
  assert.equal((await sync(b, a, 50)).resyncRequired, true);
});

test("purged tombstones raise the floor, and a cursor below it must resync", async () => {
  const a = await newUser("floora"); const b = await newUser("floorb");
  const messages = await Promise.all([1, 2, 3, 4].map((index) => send(a, b, `m${index}`)));
  const cursor = 2;
  await deleteMessageById((await getMessageById(messages[3]!.id))!);
  await deleteMessageById((await getMessageById(messages[2]!.id))!);
  const conversation = await conversationOf(a, b);
  await database.updateTable("message_deletions").set({ deleted_at: new Date(Date.now() - 31 * 86_400_000) }).where("conversation_id", "=", conversation.id).execute();
  // An orphan: a tombstone whose conversation no longer exists.
  await database.insertInto("message_deletions").values({ message_id: randomUUID(), conversation_id: randomUUID(), change_seq: 1 }).execute();
  await purgeMessageTombstones(new Date(Date.now() - 30 * 86_400_000));
  const after = await conversationOf(a, b);
  assert.equal(Number(after.tombstone_floor_seq), 6, "the floor is the highest purged change_seq");
  assert.equal(Number((await database.selectFrom("message_deletions").select((expression) => expression.fn.countAll<string>().as("count")).where("conversation_id", "=", conversation.id).executeTakeFirstOrThrow()).count), 0);
  assert.equal((await database.selectFrom("message_deletions").select("message_id").where(sql<boolean>`not exists (select 1 from conversations c where c.id = message_deletions.conversation_id)`).execute()).length, 0, "orphans are gone");
  assert.equal((await sync(b, a, cursor)).resyncRequired, true, "deletions between the cursor and the floor are unknowable");
  assert.equal((await sync(b, a, 0)).resyncRequired, false, "a client with nothing to patch can start from zero");
  assert.equal((await sync(b, a, 6)).resyncRequired, false);
});

test("partnerLastReadSeq follows what the partner has seen, and a member's own messages never advance it", async () => {
  const a = await newUser("reada"); const b = await newUser("readb");
  const [m1, m2, m3] = [await send(a, b, "1"), await send(a, b, "2"), await send(a, b, "3")];
  assert.equal((await sync(a, b, 0)).partnerLastReadSeq, 0, "b has seen nothing");
  // b answers without reading: b's own message is no evidence b read a's.
  await send(b, a, "typing blind");
  assert.equal((await sync(a, b, 0)).partnerLastReadSeq, 0);
  await database.updateTable("messages").set({ seen: true }).where("id", "=", m1.id).execute();
  assert.equal((await sync(a, b, 0)).partnerLastReadSeq, m2.seq! - 1, "read up to the message before the first unseen one");
  const readSeq = await markMessagesSeen(b, a);
  const page = await sync(a, b, 0);
  assert.equal(page.partnerLastReadSeq, page.latestSeq, "nothing unseen: the newest position");
  assert.equal(readSeq, page.latestSeq, "markMessagesSeen reports the same position");
  assert.ok(m3.seq! <= page.partnerLastReadSeq);
});

test("sync is read-only: it marks nothing as seen", async () => {
  const a = await newUser("roa"); const b = await newUser("rob");
  const message = await send(a, b);
  await sync(b, a, 0);
  const row = await database.selectFrom("messages").select("seen").where("id", "=", message.id).executeTakeFirstOrThrow();
  assert.equal(row.seen, false);
  const participant = await database.selectFrom("conversation_participants").select("unread_count").where("user_id", "=", b).executeTakeFirstOrThrow();
  assert.equal(participant.unread_count, 1);
});

test("a stranger cannot sync somebody else's conversation, whatever id they pass", async () => {
  const a = await newUser("priva"); const b = await newUser("privb"); const stranger = await newUser("privs");
  const message = await send(a, b, "secret");
  const page = await sync(stranger, b, 0, { conversationId: message.conversationId });
  assert.equal(page.conversationGone, true);
  assert.deepEqual(page.messages, []);
  assert.ok(!JSON.stringify(page).includes("secret"));
});

test("the migration backfill numbers existing messages in order, per conversation", async () => {
  const a = await newUser("filla"); const b = await newUser("fillb");
  await send(a, b, "seed");
  const conversation = await conversationOf(a, b);
  await database.transaction().execute(async (transaction) => {
    // Recreate rows as they were before migration 016: no trigger, no number.
    await sql`alter table messages disable trigger messages_assign_seq`.execute(transaction);
    await sql`alter table messages alter column seq drop not null`.execute(transaction);
    await sql`update messages set seq = null where conversation_id = ${conversation.id}::uuid`.execute(transaction);
    await sql`update conversations set last_seq = 0 where id = ${conversation.id}::uuid`.execute(transaction);
    await sql`insert into messages (conversation_id, from_user_id, to_user_id, text, message_type, created_at)
      select ${conversation.id}::uuid, ${a}::uuid, ${b}::uuid, 'old ' || g, 'text', now() - (g || ' minutes')::interval from generate_series(1, 5) g`.execute(transaction);
    await backfillMessageSequence(transaction);
    const rows = await transaction.selectFrom("messages").select(["seq", "created_at"]).where("conversation_id", "=", conversation.id).orderBy("created_at").orderBy("id").execute();
    assert.deepEqual(rows.map((row) => Number(row.seq)), [1, 2, 3, 4, 5, 6], "1..n in (created_at, id) order");
    const counter = await transaction.selectFrom("conversations").select("last_seq").where("id", "=", conversation.id).executeTakeFirstOrThrow();
    assert.equal(Number(counter.last_seq), 6);
    // Undo the schema changes above; nothing of this transaction is kept.
    throw new RollbackSignal();
  }).catch((error: unknown) => { if (!(error instanceof RollbackSignal)) throw error; });
});

class RollbackSignal extends Error {}
