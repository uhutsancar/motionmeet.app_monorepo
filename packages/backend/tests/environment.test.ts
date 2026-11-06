import assert from "node:assert/strict";
import test from "node:test";
import { loadEnvironment, resetEnvironmentForTests } from "../configs/environment.js";

const managedKeys = [
  "NODE_ENV", "DATABASE_URL", "REDIS_URL", "FRONTEND_URL", "CORS_ORIGINS", "JWT_SECRET",
  "MEDIA_UPLOADS_ENABLED", "EMAIL_ENABLED", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
  "AWS_BUCKET_NAME", "IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_URL_ENDPOINT",
  "SMTP_USER", "SMTP_PASS", "SENDER_EMAIL", "ALLOW_INSECURE_REDIS_TLS",
  "OUTBOX_TRANSPORT", "RABBITMQ_URL", "ALLOW_INSECURE_RABBITMQ_TLS", "MOTIONMEET_PROCESS_ROLE", "METRICS_PORT",
  "CACHE_READS_ENABLED",
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
  // Whatever the developer's shell exports must not leak into these cases.
  for (const key of ["OUTBOX_TRANSPORT", "RABBITMQ_URL", "ALLOW_INSECURE_RABBITMQ_TLS", "MOTIONMEET_PROCESS_ROLE", "METRICS_PORT", "CACHE_READS_ENABLED"] as const) delete process.env[key];
  resetEnvironmentForTests();
};

test("the broker transport needs a broker URL, and production needs it authenticated over TLS", () => {
  try {
    productionBase(); process.env.OUTBOX_TRANSPORT = "rabbitmq"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /RABBITMQ_URL is required/);
    process.env.RABBITMQ_URL = "amqp://app:secret@rabbitmq:5672"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /amqps/);
    process.env.RABBITMQ_URL = "amqps://rabbitmq:5671"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /credentials/);
    process.env.RABBITMQ_URL = "amqps://app:secret@rabbitmq:5671/motionmeet"; resetEnvironmentForTests();
    assert.equal(loadEnvironment().outboxTransport, "rabbitmq");
    process.env.RABBITMQ_URL = "amqp://app:secret@rabbitmq:5672"; process.env.ALLOW_INSECURE_RABBITMQ_TLS = "true"; resetEnvironmentForTests();
    assert.doesNotThrow(() => loadEnvironment());
  } finally { restore(); }
});

test("unknown transports and process roles are refused rather than defaulted", () => {
  try {
    productionBase(); process.env.OUTBOX_TRANSPORT = "kafka"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /OUTBOX_TRANSPORT/);
    productionBase(); process.env.MOTIONMEET_PROCESS_ROLE = "cron"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /MOTIONMEET_PROCESS_ROLE/);
    productionBase(); resetEnvironmentForTests();
    const defaults = loadEnvironment();
    assert.equal(defaults.outboxTransport, "direct");
    assert.equal(defaults.processRole, "api");
    assert.equal(defaults.metricsPort, null);
  } finally { restore(); }
});

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

test("the owner cache serves by default and can be switched off for a deploy window", () => {
  try {
    productionBase();
    assert.equal(loadEnvironment().cacheReadsEnabled, true);
    process.env.CACHE_READS_ENABLED = "false"; resetEnvironmentForTests();
    assert.equal(loadEnvironment().cacheReadsEnabled, false);
    process.env.CACHE_READS_ENABLED = "sometimes"; resetEnvironmentForTests();
    assert.throws(() => loadEnvironment(), /CACHE_READS_ENABLED/);
  } finally { restore(); }
});
