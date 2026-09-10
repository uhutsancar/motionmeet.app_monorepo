import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { loadEnvironment } from "./environment.js";

/**
 * Single Paddle client for the process, matching how `configs/database.ts`
 * and `configs/redis.ts` expose one shared connection rather than one per
 * call site. `PADDLE_ENVIRONMENT` decides everything - there is no separate
 * base-URL setting, so a boot with `sandbox` configured can never reach the
 * live API by a stray hardcoded URL.
 *
 * Returns null when Paddle isn't configured (`PADDLE_ENABLED=false`, the
 * default) so every caller can no-op instead of every module needing its own
 * "is this on" check.
 */
let cachedClient: Paddle | null | undefined;

export const getPaddleClient = (): Paddle | null => {
  if (cachedClient !== undefined) return cachedClient;
  const environment = loadEnvironment();
  if (!environment.paddleEnabled || !environment.paddleApiKey) {
    cachedClient = null;
    return cachedClient;
  }
  cachedClient = new Paddle(environment.paddleApiKey, {
    environment: environment.paddleEnvironment === "live" ? Environment.production : Environment.sandbox,
  });
  return cachedClient;
};

export const resetPaddleClientForTests = (): void => {
  cachedClient = undefined;
};
