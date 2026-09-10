import { database, type DatabaseTransaction } from "../configs/database.js";
import { findUserById } from "./userRepository.js";
import type { InternalUser } from "./entities.js";
import type { PlanStatus } from "@motionmeet/shared";

type Executor = typeof database | DatabaseTransaction;

export interface PlanProviderPrice {
  planId: string;
  interval: "monthly" | "yearly";
  externalProductId: string;
  externalPriceId: string;
}

/** The Paddle price id configured for a plan+interval in the active environment. Empty catalog is expected until the dashboard is set up - see docs/paddle-integration-plan.md §12. */
export const findPlanProviderPrice = async (
  planId: string,
  interval: "monthly" | "yearly",
  environment: "sandbox" | "live",
  executor: Executor = database,
): Promise<PlanProviderPrice | null> => {
  const row = await executor
    .selectFrom("plan_provider_prices")
    .selectAll()
    .where("plan_id", "=", planId)
    .where("interval", "=", interval)
    .where("environment", "=", environment)
    .where("provider", "=", "paddle")
    .executeTakeFirst();
  if (!row) return null;
  return { planId: row.plan_id, interval: row.interval, externalProductId: row.external_product_id, externalPriceId: row.external_price_id };
};

/** Reverse lookup used when a webhook arrives: which of our plans does this Paddle price id belong to. */
export const findPlanIdByExternalPrice = async (
  externalPriceId: string,
  environment: "sandbox" | "live",
  executor: Executor = database,
): Promise<string | null> => {
  const row = await executor
    .selectFrom("plan_provider_prices")
    .select(["plan_id"])
    .where("external_price_id", "=", externalPriceId)
    .where("environment", "=", environment)
    .where("provider", "=", "paddle")
    .executeTakeFirst();
  return row?.plan_id ?? null;
};

export const findUserByPaddleCustomerId = async (customerId: string, executor: Executor = database): Promise<InternalUser | null> => {
  const row = await executor.selectFrom("users").select(["id"]).where("paddle_customer_id", "=", customerId).executeTakeFirst();
  return row ? findUserById(row.id, { plan: true, sensitive: true, executor }) : null;
};

export const findUserByPaddleSubscriptionId = async (subscriptionId: string, executor: Executor = database): Promise<InternalUser | null> => {
  const row = await executor.selectFrom("users").select(["id"]).where("paddle_subscription_id", "=", subscriptionId).executeTakeFirst();
  return row ? findUserById(row.id, { plan: true, sensitive: true, executor }) : null;
};

/** Raw accessor: `serializeUser` doesn't expose this column, and the out-of-order check in subscriptionService needs the actual timestamp, not the serialized user. */
export const getLastPaddleEventOccurredAt = async (userId: string, executor: Executor = database): Promise<Date | null> => {
  const row = await executor.selectFrom("users").select(["last_paddle_event_occurred_at"]).where("id", "=", userId).executeTakeFirst();
  return row?.last_paddle_event_occurred_at ?? null;
};

export interface SubscriptionStateUpdate {
  planId: string;
  planStatus: PlanStatus;
  paddleCustomerId: string;
  paddleSubscriptionId: string;
  paddleEnvironment: "sandbox" | "live";
  planStartDate: Date | null;
  planEndDate: Date | null;
  planCancelledAt: Date | null;
  planCancelAtPeriodEnd: boolean;
  occurredAt: Date;
}

/**
 * Applies a webhook-derived subscription state to the user's row. Callers
 * must have already checked `occurredAt` against `last_paddle_event_occurred_at`
 * (see subscriptionService) so an out-of-order delivery is never written here.
 */
export const applySubscriptionState = async (
  userId: string,
  update: SubscriptionStateUpdate,
  executor: Executor = database,
): Promise<void> => {
  await executor
    .updateTable("users")
    .set({
      plan_id: update.planId,
      plan_status: update.planStatus,
      billing_provider: "paddle",
      paddle_customer_id: update.paddleCustomerId,
      paddle_subscription_id: update.paddleSubscriptionId,
      paddle_environment: update.paddleEnvironment,
      plan_start_date: update.planStartDate,
      plan_end_date: update.planEndDate,
      plan_cancelled_at: update.planCancelledAt,
      plan_cancel_at_period_end: update.planCancelAtPeriodEnd,
      last_paddle_event_occurred_at: update.occurredAt,
    })
    .where("id", "=", userId)
    .execute();
};

/** Records the Paddle customer id the first time it's seen for a user, without disturbing plan state - used when only a `customer.*` event arrives. */
export const setUserPaddleCustomerId = async (
  userId: string,
  paddleCustomerId: string,
  paddleEnvironment: "sandbox" | "live",
  executor: Executor = database,
): Promise<void> => {
  await executor
    .updateTable("users")
    .set({ paddle_customer_id: paddleCustomerId, paddle_environment: paddleEnvironment })
    .where("id", "=", userId)
    .execute();
};
