import assert from "node:assert/strict";
import test from "node:test";
import { loadEnvironment, resetEnvironmentForTests } from "../configs/environment.js";

const managedKeys = [
  "NODE_ENV", "DATABASE_URL", "REDIS_URL", "FRONTEND_URL", "CORS_ORIGINS", "JWT_SECRET",
  "MEDIA_UPLOADS_ENABLED", "EMAIL_ENABLED", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
  "AWS_BUCKET_NAME", "IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_URL_ENDPOINT",
  "SMTP_USER", "SMTP_PASS", "SENDER_EMAIL", "ALLOW_INSECURE_REDIS_TLS",
  "PADDLE_ENABLED", "PADDLE_ENVIRONMENT", "PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET",
  "ALLOW_PADDLE_SANDBOX_IN_PRODUCTION",
] as const;
const original = new Map(managedKeys.map((key) => [key, process.env[key]]));

const restore = (): void => {
  for (const key of managedKeys) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  resetEnvironmentForTests();
};

const productionBase = (): void => {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgresql://app:secret@postgres:5432/motionmeet?sslmode=require";
  process.env.REDIS_URL = "rediss://default:secret@redis:6379";
  process.env.FRONTEND_URL = "https://app.example.com";
  process.env.CORS_ORIGINS = "https://app.example.com";
  process.env.JWT_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.MEDIA_UPLOADS_ENABLED = "false";
  process.env.EMAIL_ENABLED = "false";
  resetEnvironmentForTests();
};

test("production accepts explicitly disabled optional capabilities", () => {
  try { productionBase(); assert.doesNotThrow(() => loadEnvironment()); } finally { restore(); }
});

test("production requires an explicit authenticated PostgreSQL URL", () => {
  try {
    productionBase(); delete process.env.DATABASE_URL; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /DATABASE_URL/);
    process.env.DATABASE_URL = "postgresql://postgres:5432/motionmeet"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /credentials/);
    process.env.DATABASE_URL = "mysql://app:secret@database:3306/motionmeet"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /postgres/);
  } finally { restore(); }
});

test("production rejects weak secrets and public HTTP origins", () => {
  try {
    productionBase(); process.env.JWT_SECRET = "too-short"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /JWT_SECRET/);
    productionBase(); process.env.FRONTEND_URL = "http://app.example.com"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /FRONTEND_URL/);
  } finally { restore(); }
});

test("enabled media and email capabilities require credentials", () => {
  try {
    productionBase(); process.env.MEDIA_UPLOADS_ENABLED = "true"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /media environment variables/);
    productionBase(); process.env.EMAIL_ENABLED = "true"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /email environment variables/);
  } finally { restore(); }
});

test("production Redis requires authentication and TLS", () => {
  try {
    productionBase(); process.env.REDIS_URL = "rediss://redis:6379"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /password/);
    productionBase(); process.env.REDIS_URL = "redis://default:secret@redis:6379"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /rediss/);
  } finally { restore(); }
});

test("Paddle is off by default and requires nothing", () => {
  try {
    productionBase(); resetEnvironmentForTests();
    const environment = loadEnvironment();
    assert.equal(environment.paddleEnabled, false);
    assert.equal(environment.paddleApiKey, null);
  } finally { restore(); }
});

test("enabling Paddle requires environment, api key and webhook secret", () => {
  try {
    productionBase(); process.env.PADDLE_ENABLED = "true"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /paddle environment variables/);
  } finally { restore(); }
});

test("Paddle API key prefix must match the configured environment", () => {
  try {
    productionBase();
    process.env.PADDLE_ENABLED = "true";
    process.env.PADDLE_ENVIRONMENT = "live";
    process.env.PADDLE_API_KEY = "pdl_sdbx_apikey_test";
    process.env.PADDLE_WEBHOOK_SECRET = "whsec_test";
    resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /looks like a sandbox key/);

    process.env.PADDLE_API_KEY = "pdl_live_apikey_test";
    resetEnvironmentForTests();
    assert.doesNotThrow(() => loadEnvironment());
  } finally { restore(); }
});

test("Paddle sandbox is rejected in production unless explicitly allowed", () => {
  try {
    productionBase();
    process.env.PADDLE_ENABLED = "true";
    process.env.PADDLE_ENVIRONMENT = "sandbox";
    process.env.PADDLE_API_KEY = "pdl_sdbx_apikey_test";
    process.env.PADDLE_WEBHOOK_SECRET = "whsec_test";
    resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /ALLOW_PADDLE_SANDBOX_IN_PRODUCTION/);

    process.env.ALLOW_PADDLE_SANDBOX_IN_PRODUCTION = "true";
    resetEnvironmentForTests();
    assert.doesNotThrow(() => loadEnvironment());
  } finally { restore(); }
});
