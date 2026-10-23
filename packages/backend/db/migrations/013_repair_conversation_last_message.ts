import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Points every conversation that lost its last message back at the newest
 * message it still holds.
 *
 * Deleting the newest message of a thread read the conversation's
 * `last_message_id` after the delete, by which time the foreign key's
 * ON DELETE SET NULL had already cleared it, so the previous message was never
 * promoted. The inbox lists only conversations with a last message, and the
 * whole thread disappeared from both members' message lists while its
 * messages were still there. The service now reads the pointer first; this
 * repairs the threads that were hit before that fix.
 *
 * Nothing is deleted: a conversation with no messages left keeps its row, as
 * it did before. Re-running is harmless - only rows with a null pointer and at
 * least one message are touched.
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql`
    UPDATE conversations AS conversation
    SET last_message_id = latest.id, last_message_at = latest.created_at
    FROM (
      SELECT DISTINCT ON (conversation_id) conversation_id, id, created_at
      FROM messages
      ORDER BY conversation_id, created_at DESC, id DESC
    ) AS latest
    WHERE latest.conversation_id = conversation.id
      AND conversation.last_message_id IS NULL
  `.execute(db);
};

/** A repair of pointers; there is nothing to undo. */
export const down = async (): Promise<void> => undefined;
