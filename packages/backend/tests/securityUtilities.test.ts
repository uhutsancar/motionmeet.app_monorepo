import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { loadEnvironment } from "../configs/environment.js";
import { escapeHtml } from "../utils/html.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { signAccessToken, verifyAccessToken } from "../utils/authTokens.js";
import { isFiniteNumber } from "../utils/validation.js";

test("HTML escaping protects email templates", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')">&`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;"
  );
});

test("media signature validation does not trust MIME labels", () => {
  assert.equal(
    hasValidMediaSignature({
      buffer: Buffer.from([0xff, 0xd8, 0xff, ...new Array(9).fill(0)]),
      mimetype: "image/jpeg",
    }),
    true
  );
  assert.equal(
    hasValidMediaSignature({
      buffer: Buffer.from("<script>bad</script>"),
      mimetype: "image/jpeg",
    }),
    false
  );
  assert.equal(
    hasValidMediaSignature({
      buffer: Buffer.from([0xff, 0xd8, 0xff, ...new Array(9).fill(0)]),
      mimetype: "image/jpg",
    }),
    true
  );
  assert.equal(
    hasValidMediaSignature({
      buffer: Buffer.concat([
        Buffer.from([0, 0, 0, 24]),
        Buffer.from("ftypheif"),
      ]),
      mimetype: "image/heif",
    }),
    true
  );
});

test("legacy ImageKit URLs resolve to safe object keys", () => {
  assert.equal(
    extractS3Key(
      "https://ik.imagekit.io/account/tr:q-auto,f-webp/posts/123-file.jpg"
    ),
    "posts/123-file.jpg"
  );
  assert.equal(
    extractS3Key(
      "https://cdn.example.com/profiles/user/123-file.jpg?tr=w-512"
    ),
    "profiles/user/123-file.jpg"
  );
});

test("access tokens enforce issuer and audience", () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-bytes-long";
  try {
    const { token } = signAccessToken("user_123", "session_123");
    const decoded = verifyAccessToken(token);
    assert.equal(decoded.id, "user_123");
    assert.equal(decoded.sid, "session_123");
    assert.throws(() => verifyAccessToken(`${token}broken`));

    const secret = loadEnvironment().jwtSecret;
    const claims = { id: "user_123", sid: "session_123" };
    const valid = { algorithm: "HS256", audience: "motionmeet-clients", issuer: "motionmeet-api", expiresIn: "15m" } as const;
    assert.throws(() => verifyAccessToken(jwt.sign(claims, secret, { ...valid, issuer: "someone-else" })), /issuer/);
    assert.throws(() => verifyAccessToken(jwt.sign(claims, secret, { ...valid, audience: "other-clients" })), /audience/);
    assert.throws(() => verifyAccessToken(jwt.sign(claims, secret, { ...valid, algorithm: "HS512" })), /algorithm/);
    assert.throws(() => verifyAccessToken(jwt.sign(claims, "a-different-secret-of-at-least-32-bytes", valid)), /signature/);
    assert.throws(() => verifyAccessToken(jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 }, secret, { algorithm: "HS256", audience: valid.audience, issuer: valid.issuer })), /expired/);
    assert.throws(() => verifyAccessToken(jwt.sign({ id: "user_123" }, secret, valid)), /payload/);
    const unsigned = [{ alg: "none", typ: "JWT" }, { ...claims, aud: valid.audience, iss: valid.issuer, exp: Math.floor(Date.now() / 1000) + 600 }]
      .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".");
    assert.throws(() => verifyAccessToken(`${unsigned}.`));
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test("numeric validation rejects JSON type coercion", () => {
  assert.equal(isFiniteNumber([], { min: 0, max: 10 }), false);
  assert.equal(isFiniteNumber(true, { min: 0, max: 10 }), false);
  assert.equal(isFiniteNumber("  ", { min: 0, max: 10 }), false);
  assert.equal(isFiniteNumber("7.5", { min: 0, max: 10 }), true);
});
