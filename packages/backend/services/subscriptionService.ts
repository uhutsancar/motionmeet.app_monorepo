import type { SubscriptionNotification } from "@paddle/paddle-node-sdk";
import type { PlanStatus } from "@motionmeet/shared";
import { withTransaction } from "../configs/database.js";
import { findUserById } from "../repositories/userRepository.js";
import {
  applySubscriptionState,
  findPlanIdByExternalPrice,
  findUserByPaddleSubscriptionId,
  getLastPaddleEventOccurredAt,
} from "../repositories/paymentRepository.js";
import { logger } from "../utils/logger.js";
import { isUuid } from "../utils/validation.js";

/** Paddle spells this 'canceled' (US); this app's enum already used 'cancelled' before Paddle existed. */
const STATUS_MAP: Record<string, PlanStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  paused: "paused",
  canceled: "cancelled",
};

export interface SubscriptionEventContext {
  environment: "sandbox" | "live";
  occurredAt: Date;
}

export interface SubscriptionEventResult {
  applied: boolean;
  reason?: string;
}

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Resolves which MotionMeet user a subscription.* webhook belongs to.
 *
 * `paddle_subscription_id` is authoritative once it's been set (every event
 * after the first). Before that, only `custom_data.motionmeetUserId` -
 * generated server-side at checkout-intent time, never trusted from the
 * client - can identify the user. See docs/paddle-integration-plan.md §7.4, §10.
 */
const resolveUserId = async (subscription: SubscriptionNotification): Promise<{ userId: string; existingPaddleCustomerId: string } | { userId: null; reason: string }> => {
  const bySubscription = await findUserByPaddleSubscriptionId(subscription.id);
  if (bySubscription) return { userId: bySubscription.id, existingPaddleCustomerId: bySubscription.paddleCustomerId ?? "" };

  const candidateUserId = subscription.customData?.motionmeetUserId;
  if (!isUuid(candidateUserId)) return { userId: null, reason: "no_known_subscription_and_no_valid_custom_data" };

  const user = await findUserById(candidateUserId, { plan: false, sensitive: true });
  if (!user) return { userId: null, reason: "custom_data_user_not_found" };

  // First purchase: the user has no Paddle customer id yet, or it already
  // matches - either way this webhook's customer_id is trustworthy. If it
  // already differs, something is wrong (spoofed custom_data, or the same
  // account somehow linked to two Paddle customers) and this event must not
  // silently overwrite an unrelated customer's subscription onto this user.
  if (user.paddleCustomerId && user.paddleCustomerId !== subscription.customerId) {
    return { userId: null, reason: "customer_id_mismatch" };
  }
  return { userId: user.id, existingPaddleCustomerId: user.paddleCustomerId ?? "" };
};

export const applySubscriptionEvent = async (
  subscription: SubscriptionNotification,
  context: SubscriptionEventContext,
): Promise<SubscriptionEventResult> => {
  const resolved = await resolveUserId(subscription);
  if (resolved.userId === null) {
    logger.warn("paddle_subscription_user_unresolved", { subscriptionId: subscription.id, reason: resolved.reason });
    return { applied: false, reason: resolved.reason };
  }
  const { userId } = resolved;

  const planStatus = STATUS_MAP[subscription.status];
  if (!planStatus) {
    logger.warn("paddle_subscription_unknown_status", { subscriptionId: subscription.id, status: subscription.status });
    return { applied: false, reason: "unknown_status" };
  }

  const priceId = subscription.items[0]?.price?.id ?? null;
  const planId = priceId ? await findPlanIdByExternalPrice(priceId, context.environment) : null;
  if (!planId) {
    // Expected until the Paddle dashboard catalog + plan_provider_prices are
    // filled in - see docs/paddle-integration-plan.md §12. Not applying here
    // is deliberate: guessing a plan would risk granting the wrong one.
    logger.warn("paddle_subscription_price_unmapped", { subscriptionId: subscription.id, priceId, environment: context.environment });
    return { applied: false, reason: "unmapped_price" };
  }

  return withTransaction(async (transaction) => {
    // Re-checked inside the transaction: two deliveries of different events
    // for the same subscription could otherwise interleave between the
    // earlier read and this write.
    const lastAppliedAt = await getLastPaddleEventOccurredAt(userId, transaction);
    if (lastAppliedAt && lastAppliedAt.getTime() > context.occurredAt.getTime()) {
      logger.info("paddle_subscription_event_stale", { subscriptionId: subscription.id, userId, occurredAt: context.occurredAt.toISOString(), lastAppliedAt: lastAppliedAt.toISOString() });
      return { applied: false, reason: "out_of_order" };
    }

    await applySubscriptionState(userId, {
      planId,
      planStatus,
      paddleCustomerId: subscription.customerId,
      paddleSubscriptionId: subscription.id,
      paddleEnvironment: context.environment,
      planStartDate: toDate(subscription.startedAt),
      planEndDate: toDate(subscription.currentBillingPeriod?.endsAt ?? subscription.nextBilledAt),
      planCancelledAt: toDate(subscription.canceledAt),
      planCancelAtPeriodEnd: subscription.scheduledChange?.action === "cancel",
      occurredAt: context.occurredAt,
    }, transaction);

    return { applied: true };
  });
};
