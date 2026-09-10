/**
 * Paddle.js loader.
 *
 * Loaded lazily, once, only by pages that actually open a checkout (Pricing)
 * - not injected into every page via index.html. `VITE_PADDLE_ENVIRONMENT`
 * decides sandbox vs live the same way the backend's `PADDLE_ENVIRONMENT`
 * does; the two must be kept in sync by whoever sets the env vars, since the
 * client and server can't verify each other's environment choice.
 */

export interface PaddleCheckoutItem {
  priceId: string;
  quantity?: number;
}

export interface PaddleCheckoutOptions {
  items: PaddleCheckoutItem[];
  customer?: { email?: string };
  customData?: Record<string, unknown>;
}

interface PaddleGlobal {
  Environment: { set: (env: "sandbox" | "production") => void };
  Initialize: (options: { token: string; eventCallback?: (event: { name: string; data?: unknown }) => void }) => void;
  Checkout: { open: (options: PaddleCheckoutOptions) => void };
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

const PADDLE_JS_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";

const loadScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${PADDLE_JS_URL}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = PADDLE_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paddle.js"));
    document.head.appendChild(script);
  });

let paddlePromise: Promise<PaddleGlobal> | null = null;

/**
 * Loads and initializes Paddle.js exactly once; every call after the first
 * reuses the same promise and ignores a differently-shaped `onEvent` (there's
 * only one `<script>` and one `Initialize()` call for the page's lifetime).
 */
export const getPaddle = (onEvent?: (event: { name: string; data?: unknown }) => void): Promise<PaddleGlobal> => {
  if (paddlePromise) return paddlePromise;

  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  const environment = import.meta.env.VITE_PADDLE_ENVIRONMENT === "live" ? "live" : "sandbox";
  if (!token) {
    return Promise.reject(new Error("Checkout is not configured"));
  }
  if (environment === "live" && token.startsWith("test_")) {
    // A sandbox client-side token used against a live-flagged build would
    // silently show real customers a "Test Mode" checkout - fail loudly
    // instead. See docs/paddle-integration-plan.md §3.
    return Promise.reject(new Error("VITE_PADDLE_CLIENT_TOKEN looks like a sandbox token but VITE_PADDLE_ENVIRONMENT is live"));
  }

  paddlePromise = loadScript().then(() => {
    if (!window.Paddle) throw new Error("Paddle.js did not load correctly");
    if (environment === "sandbox") window.Paddle.Environment.set("sandbox");
    window.Paddle.Initialize({ token, eventCallback: onEvent });
    return window.Paddle;
  });
  return paddlePromise;
};
