import assert from "node:assert/strict";
import test from "node:test";
import { childContext, contextFromHeaders, currentContext, formatTraceparent, parseTraceparent, runWithContext } from "../observability/context.js";

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN = "00f067aa0ba902b7";

test("a valid W3C traceparent is continued", () => {
  assert.deepEqual(parseTraceparent(`00-${TRACE}-${SPAN}-01`), { traceId: TRACE, parentSpanId: SPAN });
  const context = contextFromHeaders({ traceparent: `00-${TRACE}-${SPAN}-01` });
  assert.equal(context.traceId, TRACE);
  assert.notEqual(context.spanId, SPAN);
  assert.match(formatTraceparent(context), new RegExp(`^00-${TRACE}-[0-9a-f]{16}-01$`));
});

test("malformed or all-zero trace headers start a fresh trace", () => {
  for (const header of [undefined, "", "garbage", `00-${"0".repeat(32)}-${SPAN}-01`, `00-${TRACE}-${"0".repeat(16)}-01`, `01-${TRACE}-${SPAN}-01`, ["array"]]) {
    assert.equal(parseTraceparent(header), null);
    assert.match(contextFromHeaders({ traceparent: header }).traceId, /^[0-9a-f]{32}$/);
  }
});

test("an incoming request id is kept only when it cannot inject anything into logs", () => {
  assert.equal(contextFromHeaders({ requestId: "mobile-op-1234" }).requestId, "mobile-op-1234");
  for (const requestId of ["short", "has space in it", "line\nbreak-injection", "x".repeat(200), 42]) {
    assert.notEqual(contextFromHeaders({ requestId }).requestId, requestId);
  }
});

test("background work inherits the trace of what caused it", () => {
  assert.equal(childContext({ traceId: TRACE }).traceId, TRACE);
  assert.match(childContext({ traceId: "not-a-trace" }).traceId, /^[0-9a-f]{32}$/);
  assert.match(childContext({ traceId: null }).traceId, /^[0-9a-f]{32}$/);
});

test("the context is visible to async work started inside it, and only there", async () => {
  const context = childContext({ traceId: TRACE });
  assert.equal(currentContext(), undefined);
  await runWithContext(context, async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    assert.equal(currentContext()?.traceId, TRACE);
  });
  assert.equal(currentContext(), undefined);
});
