import assert from "node:assert/strict";
import test from "node:test";
import { validateEnvironment } from "../configs/validateEnv.js";

const managedKeys = [
  "NODE_ENV",
  "MONGODB_URL",
  "MONGODB_DB_NAME",
  "REDIS_URL",
  "FRONTEND_URL",
  "CORS_ORIGINS",
  "JWT_SECRET",
  "MEDIA_UPLOADS_ENABLED",
  "EMAIL_ENABLED",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_BUCKET_NAME",
  "IMAGEKIT_PUBLIC_KEY",
  "IMAGEKIT_PRIVATE_KEY",
  "IMAGEKIT_URL_ENDPOINT",
  "SMTP_USER",
  "SMTP_PASS",
  "SENDER_EMAIL",
];

const originalEnvironment = Object.fromEntries(
  managedKeys.map((key) => [key, process.env[key]]),
);

const restoreEnvironment = () => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const configureProductionBase = () => {
  process.env.NODE_ENV = "production";
  process.env.MONGODB_URL = "mongodb://mongo:27017/motionmeet";
  process.env.MONGODB_DB_NAME = "motionmeet";
  process.env.REDIS_URL = "redis://redis:6379";
  process.env.FRONTEND_URL = "https://app.example.com";
  process.env.CORS_ORIGINS = "https://app.example.com";
  process.env.JWT_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.MEDIA_UPLOADS_ENABLED = "false";
  process.env.EMAIL_ENABLED = "false";
};

test("production accepts explicitly disabled optional capabilities", () => {
  try {
    configureProductionBase();
    assert.doesNotThrow(() => validateEnvironment());
  } finally {
    restoreEnvironment();
  }
});

test("database name is explicit and cannot use MongoDB's implicit test database", () => {
  try {
    configureProductionBase();
    delete process.env.MONGODB_DB_NAME;
    assert.throws(() => validateEnvironment(), /MONGODB_DB_NAME/);

    process.env.MONGODB_DB_NAME = "test";
    assert.throws(() => validateEnvironment(), /explicit application database/);

    process.env.MONGODB_DB_NAME = "motionmeet";
    assert.doesNotThrow(() => validateEnvironment());
  } finally {
    restoreEnvironment();
  }
});

test("production rejects weak secrets and non-HTTPS browser origins", () => {
  try {
    configureProductionBase();
    process.env.JWT_SECRET = "too-short";
    assert.throws(() => validateEnvironment(), /JWT_SECRET/);

    process.env.JWT_SECRET = "0123456789abcdef0123456789abcdef";
    process.env.FRONTEND_URL = "http://app.example.com";
    assert.throws(() => validateEnvironment(), /FRONTEND_URL/);
  } finally {
    restoreEnvironment();
  }
});

test("enabled media and email capabilities require credentials", () => {
  try {
    configureProductionBase();
    process.env.MEDIA_UPLOADS_ENABLED = "true";
    assert.throws(() => validateEnvironment(), /media environment variables/);

    process.env.MEDIA_UPLOADS_ENABLED = "false";
    process.env.EMAIL_ENABLED = "true";
    assert.throws(() => validateEnvironment(), /email environment variables/);
  } finally {
    restoreEnvironment();
  }
});
