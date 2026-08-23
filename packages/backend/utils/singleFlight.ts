/**
 * Collapses concurrent work for the same key onto one execution.
 *
 * Cached reads are the reason this exists. A cache entry expiring under load
 * lets every request that arrives in the gap issue the same PostgreSQL query -
 * a thousand concurrent feed readers become a thousand identical feed queries.
 * Here the first caller runs it and the rest await the same promise.
 *
 * It is process-local on purpose. A distributed lock would add a Redis round
 * trip to every miss, and with N instances the fan-in is already reduced from
 * "one query per request" to "one query per instance", which is what the
 * database actually needs protecting from.
 */
const inFlight = new Map<string, Promise<unknown>>();

export const singleFlight = async <T>(key: string, run: () => Promise<T>): Promise<T> => {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const started = run().finally(() => { inFlight.delete(key); });
  inFlight.set(key, started);
  return started;
};

/** Number of distinct keys currently executing. Exposed for tests and metrics. */
export const inFlightCount = (): number => inFlight.size;
