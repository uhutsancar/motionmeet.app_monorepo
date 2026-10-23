import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Retires plans and payments.
 *
 * MotionMeet is free for every member now; ads are the only revenue. The plan
 * tables, the per-user plan/provider columns and the Paddle webhook log have no
 * reader left in the application, so they go - but not blind.
 *
 * Anything that could be a record of a real purchase is copied into
 * `legacy_billing_archive` first, as plain JSON: every member who was on a
 * paid plan or carries a provider customer/subscription id, every webhook
 * event, and the plan catalogue itself. Nothing in the app reads that table;
 * it exists so an operator can still answer a billing question after this
 * migration has run. Members' content, follows, workouts and statistics are
 * untouched - only billing columns are dropped.
 *
 * The drops deliberately avoid CASCADE: if some object nobody knew about
 * still depends on these tables or types, the migration fails and rolls back
 * instead of quietly taking that object with it.
 *
 * One-way by design. `down()` refuses rather than resurrecting a payment
 * schema the code no longer understands; the archive holds the data.
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    CREATE TABLE IF NOT EXISTS legacy_billing_archive (
      id bigserial PRIMARY KEY,
      source varchar(40) NOT NULL,
      payload jsonb NOT NULL,
      archived_at timestamptz NOT NULL DEFAULT now()
    );

    INSERT INTO legacy_billing_archive (source, payload)
    SELECT 'users', jsonb_build_object(
      'user_id', u.id,
      'plan_slug', p.slug,
      'plan_status', u.plan_status,
      'plan_start_date', u.plan_start_date,
      'plan_end_date', u.plan_end_date,
      'plan_cancelled_at', u.plan_cancelled_at,
      'plan_cancel_at_period_end', u.plan_cancel_at_period_end,
      'stripe_customer_id', u.stripe_customer_id,
      'stripe_subscription_id', u.stripe_subscription_id,
      'paddle_customer_id', u.paddle_customer_id,
      'paddle_subscription_id', u.paddle_subscription_id,
      'billing_provider', u.billing_provider,
      'paddle_environment', u.paddle_environment,
      'last_paddle_event_occurred_at', u.last_paddle_event_occurred_at
    )
    FROM users u
    LEFT JOIN plans p ON p.id = u.plan_id
    WHERE u.plan_status <> 'free'
       OR coalesce(p.slug, 'free') <> 'free'
       OR u.stripe_customer_id <> '' OR u.stripe_subscription_id <> ''
       OR u.paddle_customer_id <> '' OR u.paddle_subscription_id <> '';

    INSERT INTO legacy_billing_archive (source, payload)
    SELECT 'payment_webhook_events', to_jsonb(e) FROM payment_webhook_events e;

    INSERT INTO legacy_billing_archive (source, payload)
    SELECT 'plan_provider_prices', to_jsonb(pp) FROM plan_provider_prices pp;

    INSERT INTO legacy_billing_archive (source, payload)
    SELECT 'plans', to_jsonb(p) || jsonb_build_object(
      'billing_cycles',
      coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM plan_billing_cycles c WHERE c.plan_id = p.id), '[]'::jsonb)
    )
    FROM plans p;

    DROP INDEX IF EXISTS users_paddle_subscription_idx;
    DROP INDEX IF EXISTS users_paddle_customer_idx;
    DROP INDEX IF EXISTS users_plan_status_idx;
    ALTER TABLE users
      DROP COLUMN IF EXISTS plan_id,
      DROP COLUMN IF EXISTS plan_status,
      DROP COLUMN IF EXISTS plan_start_date,
      DROP COLUMN IF EXISTS plan_end_date,
      DROP COLUMN IF EXISTS plan_cancelled_at,
      DROP COLUMN IF EXISTS plan_cancel_at_period_end,
      DROP COLUMN IF EXISTS stripe_customer_id,
      DROP COLUMN IF EXISTS stripe_subscription_id,
      DROP COLUMN IF EXISTS paddle_customer_id,
      DROP COLUMN IF EXISTS paddle_subscription_id,
      DROP COLUMN IF EXISTS billing_provider,
      DROP COLUMN IF EXISTS paddle_environment,
      DROP COLUMN IF EXISTS last_paddle_event_occurred_at;

    DROP TABLE IF EXISTS payment_webhook_events;
    DROP TABLE IF EXISTS plan_provider_prices;
    DROP TABLE IF EXISTS plan_billing_cycles;
    DROP TABLE IF EXISTS plans;

    DROP TYPE IF EXISTS billing_environment;
    DROP TYPE IF EXISTS billing_provider;
    DROP TYPE IF EXISTS billing_interval;
    DROP TYPE IF EXISTS plan_status;
  `).execute(db);
};

export const down = async (): Promise<void> => {
  throw new Error("012_retire_billing is one-way; billing data is kept in legacy_billing_archive");
};
