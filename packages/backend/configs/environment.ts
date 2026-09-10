const MIN_PRODUCTION_SECRET_LENGTH = 32;

export interface Environment {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  redisUrl: string | null;
  jwtSecret: string;
  frontendUrl: string;
  corsOrigins: string[];
  databasePoolMin: number;
  databasePoolMax: number;
  databaseConnectionTimeoutMs: number;
  databaseIdleTimeoutMs: number;
  databaseStatementTimeoutMs: number;
  mediaUploadsEnabled: boolean;
  emailEnabled: boolean;
  scheduledJobsEnabled: boolean;
  paddleEnabled: boolean;
  paddleEnvironment: "sandbox" | "live" | null;
  paddleApiKey: string | null;
  paddleWebhookSecret: string | null;
}

const integerValue = (name: string, fallback: number, minimum: number, maximum: number): number => {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const booleanValue = (name: string, fallback: boolean): boolean => {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
};

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const requireCapabilityVariables = (capability: string, names: readonly string[]): void => {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`${capability} environment variables are required: ${missing.join(", ")}`);
};

const parseUrl = (name: string, value: string, protocols: readonly string[]): URL => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${name} must use ${protocols.join(" or ")}`);
  }
  return parsed;
};

const isPrivateIpv4 = (hostname: string): boolean => {
  if (/^10(?:\.\d{1,3}){3}$/.test(hostname)) return true;
  if (/^192\.168(?:\.\d{1,3}){2}$/.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d{1,3})(?:\.\d{1,3}){2}$/);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
};

export const isDevelopmentOrigin = (origin: string): boolean => {
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) &&
      (["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsed.hostname) || isPrivateIpv4(parsed.hostname));
  } catch {
    return false;
  }
};

let cachedEnvironment: Environment | null = null;

export const loadEnvironment = (): Environment => {
  if (cachedEnvironment) return cachedEnvironment;
  const nodeEnvValue = process.env.NODE_ENV?.trim() || "development";
  if (!["development", "test", "production"].includes(nodeEnvValue)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }
  const nodeEnv = nodeEnvValue as Environment["nodeEnv"];
  const databaseUrl = required("DATABASE_URL");
  const database = parseUrl("DATABASE_URL", databaseUrl, ["postgres:", "postgresql:"]);
  const jwtSecret = required("JWT_SECRET");
  const frontendUrl = process.env.FRONTEND_URL?.trim().replace(/\/$/, "") || "http://localhost:5173";
  parseUrl("FRONTEND_URL", frontendUrl, nodeEnv === "production" ? ["https:"] : ["https:", "http:"]);
  const corsOrigins = (process.env.CORS_ORIGINS || frontendUrl).split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);
  for (const origin of corsOrigins) {
    const parsed = parseUrl("CORS_ORIGINS", origin, ["https:", "http:"]);
    if (parsed.origin !== origin) throw new Error("CORS_ORIGINS entries must contain only an origin");
    if (nodeEnv === "production" && parsed.protocol !== "https:" && !isDevelopmentOrigin(origin)) {
      throw new Error("CORS_ORIGINS entries must use https outside trusted local networks");
    }
  }
  const redisUrlValue = process.env.REDIS_URL?.trim() || null;
  const redis = redisUrlValue ? parseUrl("REDIS_URL", redisUrlValue, ["redis:", "rediss:"]) : null;
  const mediaUploadsEnabled = booleanValue("MEDIA_UPLOADS_ENABLED", true);
  const emailEnabled = booleanValue("EMAIL_ENABLED", true);
  if (mediaUploadsEnabled) requireCapabilityVariables("media", ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_BUCKET_NAME", "IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_URL_ENDPOINT"]);
  if (emailEnabled) requireCapabilityVariables("email", ["SMTP_USER", "SMTP_PASS", "SENDER_EMAIL"]);

  const paddleEnabled = booleanValue("PADDLE_ENABLED", false);
  let paddleEnvironment: "sandbox" | "live" | null = null;
  let paddleApiKey: string | null = null;
  let paddleWebhookSecret: string | null = null;
  if (paddleEnabled) {
    requireCapabilityVariables("paddle", ["PADDLE_ENVIRONMENT", "PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET"]);
    const paddleEnvironmentValue = process.env.PADDLE_ENVIRONMENT?.trim();
    if (paddleEnvironmentValue !== "sandbox" && paddleEnvironmentValue !== "live") {
      throw new Error("PADDLE_ENVIRONMENT must be sandbox or live");
    }
    paddleEnvironment = paddleEnvironmentValue;
    paddleApiKey = required("PADDLE_API_KEY");
    paddleWebhookSecret = required("PADDLE_WEBHOOK_SECRET");
    // Paddle prefixes every server-side key with which environment it belongs
    // to (pdl_sdbx_apikey_... / pdl_live_apikey_...). Catching a mismatch here
    // turns "sandbox key pointed at production config" into a boot failure
    // instead of every sandbox-flavoured API call failing at request time.
    const keyEnvironmentPrefix = paddleApiKey.startsWith("pdl_sdbx_") ? "sandbox" : paddleApiKey.startsWith("pdl_live_") ? "live" : null;
    if (keyEnvironmentPrefix && keyEnvironmentPrefix !== paddleEnvironment) {
      throw new Error(`PADDLE_API_KEY looks like a ${keyEnvironmentPrefix} key but PADDLE_ENVIRONMENT is ${paddleEnvironment}`);
    }
    if (nodeEnv === "production" && paddleEnvironment === "sandbox" && process.env.ALLOW_PADDLE_SANDBOX_IN_PRODUCTION !== "true") {
      throw new Error("PADDLE_ENVIRONMENT must be live in production unless ALLOW_PADDLE_SANDBOX_IN_PRODUCTION=true");
    }
  }

  if (nodeEnv === "production") {
    if (Buffer.byteLength(jwtSecret, "utf8") < MIN_PRODUCTION_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} bytes in production`);
    }
    if (!database.username || !database.password) throw new Error("DATABASE_URL must include credentials in production");
    if (!redis) throw new Error("REDIS_URL is required in production");
    if (!redis.password) throw new Error("REDIS_URL must include a password in production");
    if (redis.protocol !== "rediss:" && process.env.ALLOW_INSECURE_REDIS_TLS !== "true") {
      throw new Error("REDIS_URL must use rediss:// in production");
    }
  }
  cachedEnvironment = {
    nodeEnv,
    port: integerValue("PORT", 4000, 1, 65_535),
    databaseUrl,
    redisUrl: redisUrlValue,
    jwtSecret,
    frontendUrl,
    corsOrigins,
    databasePoolMin: integerValue("DATABASE_POOL_MIN", nodeEnv === "production" ? 2 : 0, 0, 100),
    databasePoolMax: integerValue("DATABASE_POOL_MAX", nodeEnv === "production" ? 30 : 10, 1, 200),
    databaseConnectionTimeoutMs: integerValue("DATABASE_CONNECTION_TIMEOUT_MS", 10_000, 500, 60_000),
    databaseIdleTimeoutMs: integerValue("DATABASE_IDLE_TIMEOUT_MS", 30_000, 1_000, 300_000),
    // Every endpoint in this API answers in tens of milliseconds when it is
    // healthy; 15 seconds is a runaway, not a slow page.
    databaseStatementTimeoutMs: integerValue("DATABASE_STATEMENT_TIMEOUT_MS", 15_000, 1_000, 120_000),
    mediaUploadsEnabled,
    emailEnabled,
    scheduledJobsEnabled: booleanValue("RUN_SCHEDULED_JOBS", true),
    paddleEnabled,
    paddleEnvironment,
    paddleApiKey,
    paddleWebhookSecret,
  };
  return cachedEnvironment;
};

export const resetEnvironmentForTests = (): void => {
  cachedEnvironment = null;
};
