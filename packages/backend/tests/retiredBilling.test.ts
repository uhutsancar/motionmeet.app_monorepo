import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { answerRetiredBilling, RETIRED_BILLING_PATHS } from "../middlewares/retiredBilling.js";

const withServer = async (run: (baseUrl: string) => Promise<void>): Promise<void> => {
  const app = express();
  let reachedHandler = false;
  app.use(RETIRED_BILLING_PATHS, answerRetiredBilling);
  app.use(express.json({ limit: "500kb", strict: true }));
  app.post("/api/payments/webhook", (_request, response) => { reachedHandler = true; response.sendStatus(200); });
  app.use((_request, response) => { response.sendStatus(404); });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    assert.equal(reachedHandler, false, "a retired route reached a handler behind it");
  } finally {
    server.close();
  }
};

test("every plans and payments route answers 410 without reading the body", async () => {
  await withServer(async (baseUrl) => {
    const requests: Array<[string, RequestInit]> = [
      ["/api/plans", { method: "GET" }],
      ["/api/plans/pro/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: "{\"plan\":\"pro\"}" }],
      ["/api/payments/webhook", { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" }],
      ["/api/payments/webhook", { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(600_000) }],
      ["/api/payments", { method: "DELETE" }],
    ];
    for (const [path, init] of requests) {
      const response = await fetch(`${baseUrl}${path}`, init);
      assert.equal(response.status, 410, `${init.method} ${path}`);
      assert.deepEqual(await response.json(), { success: false, message: "Plans and payments are no longer offered" });
    }
    assert.equal((await fetch(`${baseUrl}/api/paymentsx`)).status, 404, "only the retired prefixes are matched");
  });
});

test("the server mounts the retired routes before the JSON body parser", async () => {
  const source = await readFile(new URL("../server.ts", import.meta.url), "utf8");
  const retired = source.indexOf("app.use(RETIRED_BILLING_PATHS, answerRetiredBilling)");
  assert.ok(retired > 0, "server.ts no longer mounts the retired billing handler");
  assert.ok(retired < source.indexOf("app.use(parseJsonBody)"), "the 410 must answer before the body is parsed");
});

test("no payment provider SDK is installed in the backend", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { dependencies?: Record<string, string> };
  const paymentPackages = Object.keys(manifest.dependencies ?? {}).filter((name) => /stripe|paytr|iyzico|braintree|checkout|billing|payment/i.test(name));
  assert.deepEqual(paymentPackages, []);
});
