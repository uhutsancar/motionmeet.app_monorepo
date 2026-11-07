import { dispatchOutboxDirect } from "../services/outboxService.js";
import { errorDiagnostics, logger } from "../utils/logger.js";

export interface OutboxRelay {
  /** Lets the batch in progress finish, then stops. */
  stop: () => Promise<void>;
}

/**
 * Drains the outbox continuously.
 *
 * It used to be swept by a once-a-minute cron, so an event waited up to a
 * minute after its commit before anything happened. The relay polls instead:
 * a full batch is followed immediately by the next, an empty one by a short
 * idle wait (OUTBOX_POLL_INTERVAL_MS, default one second) on an index-only
 * claim query. Errors back off so a database outage is not hammered.
 *
 * `drainOnce` is the transport: the direct dispatcher, or a RabbitMQ publish
 * of the claimed batch. It returns how many rows it claimed.
 */
export const startOutboxRelay = ({ drainOnce, batchSize, name }: { drainOnce: (limit: number) => Promise<number>; batchSize: number; name: string }): OutboxRelay => {
  const idleMs = Math.max(100, Number(process.env.OUTBOX_POLL_INTERVAL_MS) || 1_000);
  let stopping = false;
  let wake: (() => void) | null = null;
  const pause = (ms: number): Promise<void> => new Promise((resolve) => {
    const timer = setTimeout(() => { wake = null; resolve(); }, ms);
    wake = () => { clearTimeout(timer); wake = null; resolve(); };
  });

  const loop = (async () => {
    let failures = 0;
    while (!stopping) {
      try {
        const claimed = await drainOnce(batchSize);
        failures = 0;
        if (claimed < batchSize) await pause(idleMs);
      } catch (error: unknown) {
        failures += 1;
        logger.error("outbox_relay_failed", { relay: name, failures, ...errorDiagnostics(error) });
        await pause(Math.min(30_000, 1_000 * 2 ** Math.min(failures, 5)));
      }
    }
  })();
  logger.info("outbox_relay_started", { relay: name, batchSize, idleMs });

  return {
    stop: async () => {
      stopping = true;
      wake?.();
      await loop;
    },
  };
};

/** The broker-less relay: events are handled in this process. */
export const startDirectOutboxRelay = (): OutboxRelay =>
  startOutboxRelay({ name: "direct", batchSize: 50, drainOnce: (limit) => dispatchOutboxDirect({ limit }) });
