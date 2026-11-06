import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Makes the outbox safe to hand to a message broker. Expand-only: every row
 * and column the previous release reads keeps its meaning.
 *
 * - `type` and `status` become text with CHECK constraints instead of
 *   PostgreSQL enums. Adding an enum value cannot be used in the transaction
 *   that adds it, so every new event type would have needed its own release;
 *   the CHECK keeps the same guarantee (no free-form garbage) and the event
 *   catalogue in code says which types exist.
 * - `event_id` is the event's immutable identity. Consumers deduplicate on it,
 *   so it must survive retries and re-publishing unchanged - which the row id
 *   would too, but naming it keeps a broker delivery tag from ever being
 *   mistaken for it.
 * - `published` and `dead` statuses: a row is kept, not deleted, once the
 *   broker has confirmed it (or the direct dispatcher has handled it), so there
 *   is an audit trail until the retention sweep; a row that has exhausted its
 *   attempts is parked as `dead` instead of retrying daily forever.
 * - `processed_events` is each consumer's record of what it has applied. A
 *   consumer writes it in the same transaction as its database effect, which
 *   is what makes a redelivered event a no-op.
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql`
    ALTER TABLE outbox_events ALTER COLUMN type TYPE varchar(120) USING type::text;
    ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_type_format CHECK (type ~ '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$');
    ALTER TABLE outbox_events ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE outbox_events ALTER COLUMN status TYPE varchar(20) USING status::text;
    ALTER TABLE outbox_events ALTER COLUMN status SET DEFAULT 'pending';
    ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_status_valid CHECK (status IN ('pending', 'processing', 'published', 'dead'));
    DROP TYPE IF EXISTS outbox_type;
    DROP TYPE IF EXISTS outbox_status;

    ALTER TABLE outbox_events ADD COLUMN event_id uuid NOT NULL DEFAULT gen_random_uuid();
    ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_event_id_key UNIQUE (event_id);
    ALTER TABLE outbox_events ADD COLUMN schema_version smallint NOT NULL DEFAULT 1 CHECK (schema_version > 0);
    ALTER TABLE outbox_events ADD COLUMN correlation_id varchar(128);
    ALTER TABLE outbox_events ADD COLUMN published_at timestamptz;

    -- The claim index stays; the retention sweep walks published rows by age.
    CREATE INDEX outbox_published_idx ON outbox_events (published_at) WHERE status = 'published';
    CREATE INDEX outbox_dead_idx ON outbox_events (updated_at DESC) WHERE status = 'dead';

    CREATE TABLE processed_events (
      consumer varchar(100) NOT NULL,
      event_id uuid NOT NULL,
      processed_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (consumer, event_id)
    );
    CREATE INDEX processed_events_age_idx ON processed_events (processed_at);
  `.execute(db);
};

/**
 * Restores the enum columns. Rows in the two new statuses have no meaning to
 * the previous release: published rows are done and are removed, dead rows go
 * back to pending so the older code keeps retrying them as it used to.
 */
export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql`
    DROP TABLE IF EXISTS processed_events;
    DELETE FROM outbox_events WHERE status = 'published';
    UPDATE outbox_events SET status = 'pending' WHERE status = 'dead';
    DROP INDEX IF EXISTS outbox_published_idx;
    DROP INDEX IF EXISTS outbox_dead_idx;
    ALTER TABLE outbox_events DROP COLUMN IF EXISTS published_at;
    ALTER TABLE outbox_events DROP COLUMN IF EXISTS correlation_id;
    ALTER TABLE outbox_events DROP COLUMN IF EXISTS schema_version;
    ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_event_id_key;
    ALTER TABLE outbox_events DROP COLUMN IF EXISTS event_id;
    ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_status_valid;
    ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_type_format;
    CREATE TYPE outbox_status AS ENUM ('pending', 'processing');
    CREATE TYPE outbox_type AS ENUM ('user.profile.updated', 'connection.requested');
    ALTER TABLE outbox_events ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE outbox_events ALTER COLUMN status TYPE outbox_status USING status::outbox_status;
    ALTER TABLE outbox_events ALTER COLUMN status SET DEFAULT 'pending';
    ALTER TABLE outbox_events ALTER COLUMN type TYPE outbox_type USING type::outbox_type;
  `.execute(db);
};
