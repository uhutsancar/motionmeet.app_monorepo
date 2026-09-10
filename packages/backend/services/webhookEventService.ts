import { EventName, type EventEntity } from "@paddle/paddle-node-sdk";
import type { SubscriptionNotification } from "@paddle/paddle-node-sdk";
import { claimEvent, markEventFailed, markEventIgnored, markEventProcessed } from "../repositories/webhookEventRepository.js";
import { applySubscriptionEvent } from "./subscriptionService.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

const SUBSCRIPTION_EVENT_TYPES = new Set<string>([
  EventName.SubscriptionCreated,
  EventName.SubscriptionActivated,
  EventName.SubscriptionTrialing,
  EventName.SubscriptionUpdated,
  EventName.SubscriptionPastDue,
  EventName.SubscriptionPaused,
  EventName.SubscriptionResumed,
  EventName.SubscriptionCanceled,
]);

/**
 * Processes one verified, parsed Paddle webhook event.
 *
 * `rawPayload` is the exact JSON Paddle sent (not the SDK's camelCased
 * entity) - kept for audit/debugging fidelity, per
 * docs/paddle-integration-plan.md §7.3.
 *
 * Idempotency is claimed first, before any business logic: a duplicate
 * delivery (Paddle's own retries are the expected case, not an error) exits
 * immediately without touching subscriptionService at all.
 */
export const processWebhookEvent = async (
  event: EventEntity,
  rawPayload: unknown,
  environment: "sandbox" | "live",
): Promise<void> => {
  const occurredAt = new Date(event.occurredAt);
  const isNewEvent = await claimEvent({
    eventId: event.eventId,
    notificationId: event.notificationId ?? "",
    eventType: event.eventType,
    environment,
    occurredAt,
    payload: rawPayload,
  });
  if (!isNewEvent) {
    logger.info("paddle_webhook_duplicate", { eventId: event.eventId, eventType: event.eventType });
    return;
  }

  try {
    if (SUBSCRIPTION_EVENT_TYPES.has(event.eventType)) {
      // Narrowed by the Set membership check above, which TypeScript's
      // control flow can't follow through a runtime Set lookup.
      const subscription = event.data as SubscriptionNotification;
      const result = await applySubscriptionEvent(subscription, { environment, occurredAt });
      if (result.applied) {
        await markEventProcessed(event.eventId);
      } else {
        await markEventIgnored(event.eventId, result.reason ?? "not_applied");
      }
      return;
    }

    // transaction.*, customer.*, adjustment.*, etc.: recorded for audit only
    // in v1 - no entitlement action. See docs/paddle-integration-plan.md §7.4.
    await markEventIgnored(event.eventId, "no_handler_for_event_type");
  } catch (error) {
    logger.error("paddle_webhook_processing_failed", { eventId: event.eventId, eventType: event.eventType, ...safeErrorMetadata(error) });
    await markEventFailed(event.eventId, error instanceof Error ? error.message : "unknown error");
    // Rethrown so the controller answers with 5xx and Paddle's own retry
    // schedule tries again later - this is a transient-failure path, not a
    // permanent rejection.
    throw error;
  }
};
