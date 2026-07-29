import assert from "node:assert/strict";
import test from "node:test";

import {
  API_ROUTES,
  AUTH_LIMITS,
  createOperationId,
  getUtf8ByteLength,
  hasValidPasswordByteLength,
  resolvePublicMediaUrl,
} from "../src/index.js";

test("dynamic API routes preserve resource identifiers", () => {
  assert.equal(API_ROUTES.post.comments("post-1"), "/api/post/post-1/comments");
  assert.equal(API_ROUTES.message.delete("message-1"), "/api/message/delete/message-1");
  assert.equal(API_ROUTES.exercise.stats("exercise-1"), "/api/exercise/exercise-1/stats");
});

test("password validation counts UTF-8 bytes like the backend", () => {
  assert.equal(getUtf8ByteLength("şifre🔒"), 10);
  assert.equal(hasValidPasswordByteLength("1234567890"), true);
  assert.equal(hasValidPasswordByteLength("123456789"), false);
  assert.equal(hasValidPasswordByteLength("a".repeat(AUTH_LIMITS.passwordMaxBytes + 1)), false);
});

test("operation identifiers are bounded and unique", () => {
  const first = createOperationId("message");
  const second = createOperationId("message");
  assert.match(first, /^message:/);
  assert.ok(first.length <= 128);
  assert.notEqual(first, second);
});

test("public media URLs reject empty and non-public schemes", () => {
  assert.equal(resolvePublicMediaUrl("https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg");
  assert.equal(resolvePublicMediaUrl("/uploads/a.jpg", "https://api.example.com/"), "https://api.example.com/uploads/a.jpg");
  assert.equal(resolvePublicMediaUrl("javascript:alert(1)"), null);
  assert.equal(resolvePublicMediaUrl(""), null);
});
