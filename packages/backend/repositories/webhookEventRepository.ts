import { database, type DatabaseTransaction } from "../configs/database.js";

type Executor = typeof database | DatabaseTransaction;

export interface ClaimEventInput {
  eventId: string;
  notificationId: string;
  eventType: string;
  environment: "sandbox" | "live";
  occurredAt: Date;
  payload: unknown;
}

/**
 * Inserts the event row if `event_id` hasn't been seen before.
 *
 * Returns `true` for a genuinely new event, `false` for a duplicate delivery
 * (Paddle's own retries are expected, not an error). `event_id PRIMARY KEY` +
 * `ON CONFLICT DO NOTHING` does the dedupe at the database level, so this
 * can't race even under concurrent delivery of the same event.
 */
export const claimEvent = async (input: ClaimEventInput, executor: Executor = database): Promise<boolean> => {
  const result = await executor
    .insertInto("payment_webhook_events")
    .values({
      event_id: input.eventId,
      notification_id: input.notificationId,
      event_type: input.eventType,
      environment: input.environment,
      occurred_at: input.occurredAt,
      payload: JSON.stringify(input.payload),
    })
    .onConflict((conflict) => conflict.column("event_id").doNothing())
    .executeTakeFirst();
  return result.numInsertedOrUpdatedRows === 1n;
};

export const markEventProcessed = async (eventId: string, executor: Executor = database): Promise<void> => {
  await executor
    .updateTable("payment_webhook_events")
    .set({ status: "processed", processed_at: new Date() })
    .where("event_id", "=", eventId)
    .execute();
};

export const markEventIgnored = async (eventId: string, reason: string, executor: Executor = database): Promise<void> => {
  await executor
    .updateTable("payment_webhook_events")
    .set({ status: "ignored", processed_at: new Date(), last_error: reason.slice(0, 500) })
    .where("event_id", "=", eventId)
    .execute();
};

export const markEventFailed = async (eventId: string, errorMessage: string, executor: Executor = database): Promise<void> => {
  await executor
    .updateTable("payment_webhook_events")
    .set((eb) => ({ status: "failed", attempts: eb("attempts", "+", 1), last_error: errorMessage.slice(0, 500) }))
    .where("event_id", "=", eventId)
    .execute();
};
