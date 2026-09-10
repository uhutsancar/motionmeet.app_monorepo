import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Paddle billing.
 *
 * Adds a Paddle-specific layer on top of the existing plans/plan_billing_cycles/
 * users schema without touching the (unused) stripe_* columns already there -
 * see docs/paddle-integration-plan.md for the full rationale.
 *
 * `plan_status` gains two values Paddle has and this app's enum didn't:
 * `past_due` (payment failed, Paddle is retrying) and `paused` (subscription
 * paused, no active billing). Adding an enum value is one-way in Postgres -
 * `down()` cannot remove it, only stop writing it - which is why this is
 * treated as a considered, reviewed decision rather than a routine migration.
 * Safe to do in the same transaction as the rest of this file: nothing below
 * writes a row or a constraint using 'past_due'/'paused' themselves - that
 * only happens later, from application code, in its own transaction.
 *
 * `plan_provider_prices` maps a (plan, interval) to Paddle's own product/price
 * ids, scoped by environment so sandbox and live rows can never collide. It
 * starts empty - filled in once real prices exist in the Paddle dashboard -
 * and the app must run correctly with zero rows in it.
 *
 * `payment_webhook_events` is the idempotency log: `event_id` as the primary
 * key means a duplicate delivery (Paddle's own retries are expected, not an
 * error case) hits a unique-violation on INSERT, which `errorHandler.ts`
 * already turns into a 409 - the webhook handler treats that the same as "an
 * unaffected row", not a failure.
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    ALTER TYPE plan_status ADD VALUE IF NOT EXISTS 'past_due';
    ALTER TYPE plan_status ADD VALUE IF NOT EXISTS 'paused';

    DO $$ BEGIN
      CREATE TYPE billing_provider AS ENUM ('none', 'paddle');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE billing_environment AS ENUM ('sandbox', 'live');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS paddle_customer_id varchar(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS paddle_subscription_id varchar(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS billing_provider billing_provider NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS paddle_environment billing_environment,
      ADD COLUMN IF NOT EXISTS plan_cancel_at_period_end boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_paddle_event_occurred_at timestamptz;

    CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_customer_idx
      ON users (paddle_customer_id) WHERE paddle_customer_id <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_subscription_idx
      ON users (paddle_subscription_id) WHERE paddle_subscription_id <> '';

    CREATE TABLE IF NOT EXISTS plan_provider_prices (
      plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      interval billing_interval NOT NULL,
      provider billing_provider NOT NULL DEFAULT 'paddle',
      environment billing_environment NOT NULL,
      external_product_id varchar(255) NOT NULL,
      external_price_id varchar(255) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (plan_id, interval, provider, environment)
    );

    CREATE TABLE IF NOT EXISTS payment_webhook_events (
      event_id varchar(64) PRIMARY KEY,
      notification_id varchar(64) NOT NULL,
      event_type varchar(100) NOT NULL,
      environment billing_environment NOT NULL,
      occurred_at timestamptz NOT NULL,
      received_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz,
      status varchar(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','failed','ignored')),
      attempts integer NOT NULL DEFAULT 0,
      last_error text NOT NULL DEFAULT '',
      payload jsonb NOT NULL
    );
    CREATE INDEX IF NOT EXISTS payment_webhook_events_status_idx ON payment_webhook_events (status, received_at);
    CREATE INDEX IF NOT EXISTS payment_webhook_events_subscription_idx
      ON payment_webhook_events (((payload->'data'->>'id')));
  `).execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  // The 'past_due'/'paused' enum labels stay: Postgres cannot drop one, and an
  // unused label costs nothing.
  await sql.raw(`
    DROP TABLE IF EXISTS payment_webhook_events;
    DROP TABLE IF EXISTS plan_provider_prices;
    DROP INDEX IF EXISTS users_paddle_subscription_idx;
    DROP INDEX IF EXISTS users_paddle_customer_idx;
    ALTER TABLE users
      DROP COLUMN IF EXISTS last_paddle_event_occurred_at,
      DROP COLUMN IF EXISTS plan_cancel_at_period_end,
      DROP COLUMN IF EXISTS paddle_environment,
      DROP COLUMN IF EXISTS billing_provider,
      DROP COLUMN IF EXISTS paddle_subscription_id,
      DROP COLUMN IF EXISTS paddle_customer_id;
    DROP TYPE IF EXISTS billing_environment;
    DROP TYPE IF EXISTS billing_provider;
  `).execute(db);
};
