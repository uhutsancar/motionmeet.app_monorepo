import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceForSocketMessage,
  applySyncPage,
  initialSyncState,
  mergeMessages,
  runMessageSync,
} from '../dist/index.js';
import type { Message, MessageSyncResult } from '../dist/index.js';

const CONVERSATION = 'c0000000-0000-4000-8000-000000000001';
const ME = 'u-me';
const THEM = 'u-them';
const message = (seq: number | undefined, overrides: Partial<Message> = {}): Message => ({
  id: `m${seq}`, _id: `m${seq}`, conversationId: CONVERSATION, seq,
  from_user_id: THEM, to_user_id: ME, text: `#${seq}`, message_type: 'text', media_url: '', seen: false,
  createdAt: new Date(Date.UTC(2026, 10, 6, 12, 0, seq ?? 0)).toISOString(), updatedAt: new Date(0).toISOString(),
  ...overrides,
});
const page = (overrides: Partial<MessageSyncResult>): MessageSyncResult => ({
  conversationId: CONVERSATION, conversationGone: false, resyncRequired: false, messages: [], deletedMessageIds: [],
  nextAfterSeq: 0, hasMore: false, latestSeq: 0, partnerLastReadSeq: 0, ...overrides,
});

test('the first page sets the cursor to its highest sequence number', () => {
  assert.deepEqual(initialSyncState([message(3), message(7), message(5)]), { conversationId: CONVERSATION, cursor: 7 });
  assert.deepEqual(initialSyncState([]), { conversationId: null, cursor: 0 });
});

test('a page adds messages in sequence order, drops deletions and ignores unknown ids', () => {
  const current = [message(1), message(2), message(4)];
  const next = applySyncPage(current, page({ messages: [message(6), message(5)], deletedMessageIds: ['m2', 'never-had-it'] }), ME);
  assert.deepEqual(next.map((entry) => entry.seq), [1, 4, 5, 6]);
});

test('a message the page both delivers and deletes never shows up', () => {
  const next = applySyncPage([message(1)], page({ messages: [message(2)], deletedMessageIds: ['m2'] }), ME);
  assert.deepEqual(next.map((entry) => entry.seq), [1]);
});

test("my own messages up to the partner's read position become seen, theirs and later ones do not", () => {
  const mine = (seq: number) => message(seq, { from_user_id: ME, to_user_id: THEM });
  const next = applySyncPage([mine(1), mine(2), message(3), mine(4)], page({ partnerLastReadSeq: 3 }), ME);
  assert.deepEqual(next.map((entry) => [entry.seq, entry.seen]), [[1, true], [2, true], [3, false], [4, false]]);
});

test('messages without a sequence number (an older server) keep time order alongside numbered ones', () => {
  const legacy = message(undefined, { id: 'legacy', _id: 'legacy', createdAt: new Date(Date.UTC(2026, 10, 6, 11, 59, 0)).toISOString() });
  const merged = mergeMessages([message(2)], [legacy, message(1)]);
  assert.deepEqual(merged.map((entry) => entry._id), ['legacy', 'm1', 'm2']);
});

test('a socket message advances the cursor only when it is the next number', () => {
  const state = { conversationId: CONVERSATION, cursor: 4 };
  assert.deepEqual(advanceForSocketMessage(state, message(5), false), { state: { conversationId: CONVERSATION, cursor: 5 }, syncNeeded: false });
  assert.deepEqual(advanceForSocketMessage(state, message(4), false), { state, syncNeeded: false }, 'a repeat changes nothing');
  assert.deepEqual(advanceForSocketMessage(state, message(7), false), { state, syncNeeded: true }, 'a gap asks for a sync');
});

test('while a sync runs, socket messages leave the cursor to the sync', () => {
  const state = { conversationId: CONVERSATION, cursor: 4 };
  assert.deepEqual(advanceForSocketMessage(state, message(5), true), { state, syncNeeded: false });
});

test('a socket message from another conversation, or the first one ever, is handled', () => {
  const other = message(1, { conversationId: 'c0000000-0000-4000-8000-000000000002' });
  assert.equal(advanceForSocketMessage({ conversationId: CONVERSATION, cursor: 9 }, other, false).syncNeeded, true);
  assert.deepEqual(advanceForSocketMessage({ conversationId: null, cursor: 0 }, message(1), false), { state: { conversationId: CONVERSATION, cursor: 1 }, syncNeeded: false });
});

test('the sync loop follows nextAfterSeq page by page and applies every page once', async () => {
  const requested: number[] = [];
  const applied: number[] = [];
  const outcome = await runMessageSync(
    { conversationId: CONVERSATION, cursor: 10 },
    async (afterSeq) => {
      requested.push(afterSeq);
      return afterSeq === 10 ? page({ nextAfterSeq: 110, hasMore: true, latestSeq: 250 }) : page({ nextAfterSeq: 250, hasMore: false, latestSeq: 250 });
    },
    (result) => { applied.push(result.nextAfterSeq); },
  );
  assert.deepEqual(requested, [10, 110], 'the second request continues from nextAfterSeq, not latestSeq');
  assert.deepEqual(applied, [110, 250]);
  assert.deepEqual(outcome, { kind: 'synced', state: { conversationId: CONVERSATION, cursor: 250 } });
});

test('a sync interrupted part-way resumes from the page it reached', async () => {
  let calls = 0;
  const fetchPage = async (afterSeq: number) => {
    calls += 1;
    if (calls === 2) throw new Error('network');
    return page({ nextAfterSeq: afterSeq + 50, hasMore: afterSeq + 50 < 150 });
  };
  let state = { conversationId: CONVERSATION, cursor: 0 };
  await assert.rejects(runMessageSync(state, fetchPage, (result) => { state = { conversationId: CONVERSATION, cursor: result.nextAfterSeq }; }));
  assert.equal(state.cursor, 50, 'the first page was applied and kept');
  const outcome = await runMessageSync(state, fetchPage, () => undefined);
  assert.deepEqual(outcome.state.cursor, 150);
});

test('resync, a vanished conversation and an older server each end the loop with their own outcome', async () => {
  const start = { conversationId: CONVERSATION, cursor: 5 };
  assert.equal((await runMessageSync(start, async () => page({ resyncRequired: true }), () => undefined)).kind, 'resync');
  assert.deepEqual(await runMessageSync(start, async () => page({ conversationGone: true, conversationId: null }), () => undefined), { kind: 'gone', state: { conversationId: null, cursor: 0 } });
  assert.equal((await runMessageSync(start, async () => null, () => undefined)).kind, 'unsupported');
});

test('a client too far behind stops after the page limit and resyncs', async () => {
  let calls = 0;
  const outcome = await runMessageSync({ conversationId: CONVERSATION, cursor: 0 }, async (afterSeq) => { calls += 1; return page({ nextAfterSeq: afterSeq + 1, hasMore: true }); }, () => undefined, 3);
  assert.equal(calls, 3);
  assert.equal(outcome.kind, 'resync');
});
