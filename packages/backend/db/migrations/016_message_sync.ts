import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Message synchronisation (WP-05 of the 2026-11 audit, ADR 005).
 *
 * A client that reconnects has to learn exactly what it missed: new messages
 * and deleted ones. Neither was possible. `messages.created_at` is the start
 * of the inserting transaction, not its commit, and ids are random, so a
 * "newer than the last one I saw" cursor skips a message whose transaction
 * started earlier but committed later. And deletes left no trace at all.
 *
 * This adds, per conversation:
 *
 * - `messages.seq`, assigned by a trigger from `conversations.last_seq` under
 *   the conversation row's lock. Writers already serialise on that row, so seq
 *   order is commit order, and a reader that sees `last_seq = N` sees every
 *   event numbered up to N.
 * - `message_deletions`, a tombstone per deleted message, written by a trigger
 *   with its own `change_seq` from the same counter.
 *
 * Both live in triggers rather than in application code so that an API
 * replica still running the previous release during a rolling deploy also
 * numbers what it inserts and leaves a tombstone for what it deletes.
 *
 * Large tables: the backfill rewrites every message row in one transaction
 * and the column add takes an exclusive lock for its duration. Measure it on a
 * staging copy first (docs/operations/RUNBOOKS.md, "Migration 016").
 */

/**
 * Numbers existing messages 1..n per conversation in (created_at, id) order and
 * sets each conversation's counter to its highest number. Only rows without a
 * number are touched, so it can be re-run. Exported for the integration test.
 */
export const backfillMessageSequence = async (db: Kysely<Database>): Promise<void> => {
  await sql`
    UPDATE messages m SET seq = numbered.position
    FROM (
      SELECT id, row_number() OVER (PARTITION BY conversation_id ORDER BY created_at, id) AS position
      FROM messages
    ) numbered
    WHERE m.id = numbered.id AND m.seq IS NULL`.execute(db);
  await sql`
    UPDATE conversations c
    SET last_seq = greatest(c.last_seq, coalesce((SELECT max(seq) FROM messages WHERE conversation_id = c.id), 0))`.execute(db);
};

export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_seq bigint NOT NULL DEFAULT 0`.execute(db);
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tombstone_floor_seq bigint NOT NULL DEFAULT 0`.execute(db);
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS seq bigint`.execute(db);

  await backfillMessageSequence(db);

  await sql`
    CREATE OR REPLACE FUNCTION assign_message_seq() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE conversations SET last_seq = last_seq + 1 WHERE id = NEW.conversation_id RETURNING last_seq INTO NEW.seq;
      RETURN NEW;
    END $$`.execute(db);
  await sql`DROP TRIGGER IF EXISTS messages_assign_seq ON messages`.execute(db);
  await sql`CREATE TRIGGER messages_assign_seq BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION assign_message_seq()`.execute(db);
  await sql`ALTER TABLE messages ALTER COLUMN seq SET NOT NULL`.execute(db);
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS messages_conversation_seq_idx ON messages (conversation_id, seq)`.execute(db);
  // The partner's read position is derived from the first unseen message.
  await sql`CREATE INDEX IF NOT EXISTS messages_unseen_seq_idx ON messages (conversation_id, to_user_id, seq) WHERE NOT seen`.execute(db);

  // No foreign key: a conversation deleted with its messages must not be
  // blocked by, or cascade into, its tombstones. Orphans are removed by the
  // message-tombstone-retention task.
  await sql`
    CREATE TABLE IF NOT EXISTS message_deletions (
      message_id uuid PRIMARY KEY,
      conversation_id uuid NOT NULL,
      change_seq bigint NOT NULL,
      deleted_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS message_deletions_sync_idx ON message_deletions (conversation_id, change_seq)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS message_deletions_retention_idx ON message_deletions (deleted_at)`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION record_message_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE next_seq bigint;
    BEGIN
      UPDATE conversations SET last_seq = last_seq + 1 WHERE id = OLD.conversation_id RETURNING last_seq INTO next_seq;
      -- When the conversation itself is being deleted (cascade) there is no
      -- row to number against and nobody left to sync; sync reports it gone.
      IF FOUND THEN
        INSERT INTO message_deletions (message_id, conversation_id, change_seq)
        VALUES (OLD.id, OLD.conversation_id, next_seq)
        ON CONFLICT (message_id) DO NOTHING;
      END IF;
      RETURN OLD;
    END $$`.execute(db);
  await sql`DROP TRIGGER IF EXISTS messages_record_deletion ON messages`.execute(db);
  await sql`CREATE TRIGGER messages_record_deletion AFTER DELETE ON messages FOR EACH ROW EXECUTE FUNCTION record_message_deletion()`.execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql`DROP TRIGGER IF EXISTS messages_record_deletion ON messages`.execute(db);
  await sql`DROP TRIGGER IF EXISTS messages_assign_seq ON messages`.execute(db);
  await sql`DROP FUNCTION IF EXISTS record_message_deletion()`.execute(db);
  await sql`DROP FUNCTION IF EXISTS assign_message_seq()`.execute(db);
  await sql`DROP TABLE IF EXISTS message_deletions`.execute(db);
  await sql`DROP INDEX IF EXISTS messages_unseen_seq_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS messages_conversation_seq_idx`.execute(db);
  await sql`ALTER TABLE messages DROP COLUMN IF EXISTS seq`.execute(db);
  await sql`ALTER TABLE conversations DROP COLUMN IF EXISTS tombstone_floor_seq`.execute(db);
  await sql`ALTER TABLE conversations DROP COLUMN IF EXISTS last_seq`.execute(db);
};
