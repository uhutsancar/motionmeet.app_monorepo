import assert from "node:assert/strict";
import test from "node:test";
import {
  validateLogin,
  validateRegistration,
} from "../utils/authValidation.js";

test("registration normalizes identity fields", () => {
  const result = validateRegistration({
    email: "  Athlete@Example.COM ",
    full_name: "  Ada Athlete  ",
    password: "long-enough-password",
    username: " Ada.Runner ",
  });

  assert.deepEqual(result.fieldErrors, {});
  assert.equal(result.normalized.email, "athlete@example.com");
  assert.equal(result.normalized.full_name, "Ada Athlete");
  assert.equal(result.normalized.username, "ada.runner");
});

test("registration rejects bcrypt-truncated and weak passwords", () => {
  assert.ok(validateRegistration({
    email: "a@example.com",
    full_name: "Ada",
    password: "short",
    username: "ada",
  }).fieldErrors.password);

  assert.ok(validateRegistration({
    email: "a@example.com",
    full_name: "Ada",
    password: "ü".repeat(37),
    username: "ada",
  }).fieldErrors.password);
});

test("login returns a normalized generic validation result", () => {
  const valid = validateLogin({
    email: " USER@EXAMPLE.COM ",
    password: "secret",
  });
  assert.equal(valid.email, "user@example.com");
  assert.equal(valid.valid, true);
  assert.equal(validateLogin({ email: "invalid", password: "x" }).valid, false);
});
