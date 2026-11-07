import assert from "node:assert/strict";
import test from "node:test";
import { observeDatabasePool, registry } from "../observability/metrics.js";

/**
 * The metrics the 2026-11 audit added (WP-01, WP-06, WP-10, WP-20) exist under
 * the names the alert rules in infra/prometheus/alerts.example.yml use, and
 * the pool gauge reports the pool it is given at scrape time.
 */
test("every metric the alert rules rely on is registered", async () => {
  const names = (await registry.getMetricsAsJSON()).map((metric) => metric.name);
  for (const name of [
    "motionmeet_cache_invalidation_failures_total",
    "motionmeet_media_url_unresolvable_total",
    "motionmeet_media_metadata_total",
    "motionmeet_db_pool_connections",
    "motionmeet_account_exports_total",
    "motionmeet_account_export_seconds",
    "motionmeet_events_consumed_total",
    "motionmeet_scheduled_task_runs_total",
  ]) assert.ok(names.includes(name), name);
});

test("the pool gauge reads total, idle and waiting at scrape time", async () => {
  const pool = { totalCount: 7, idleCount: 3, waitingCount: 2 };
  observeDatabasePool(pool);
  let text = await registry.getSingleMetricAsString("motionmeet_db_pool_connections");
  assert.match(text, /state="total"[^\n]*} 7/);
  assert.match(text, /state="idle"[^\n]*} 3/);
  assert.match(text, /state="waiting"[^\n]*} 2/);
  pool.waitingCount = 0;
  text = await registry.getSingleMetricAsString("motionmeet_db_pool_connections");
  assert.match(text, /state="waiting"[^\n]*} 0/);
});
