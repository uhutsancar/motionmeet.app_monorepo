import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes, randomUUID } from "node:crypto";

/**
 * Who asked for the work that is running now.
 *
 * Held in AsyncLocalStorage so a service several calls deep - the one writing
 * an outbox row, say - can stamp the request's ids on what it produces without
 * every function in between growing a parameter for it. Background work runs
 * with its own context (see `runWithContext`), so log lines and events from a
 * worker carry the id of the event that caused them.
 */
export interface OperationContext {
  /** Echoed to the client as X-Request-Id and logged on every line. */
  requestId: string;
  /** W3C trace id (32 hex); shared by everything one user action causes. */
  traceId: string;
  /** This hop's span id (16 hex). */
  spanId: string;
}

const storage = new AsyncLocalStorage<OperationContext>();

export const currentContext = (): OperationContext | undefined => storage.getStore();

export const runWithContext = <T>(context: OperationContext, work: () => T): T => storage.run(context, work);

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const ZERO_TRACE = "0".repeat(32);
const ZERO_SPAN = "0".repeat(16);
/** What an incoming X-Request-Id may contain before it is trusted into logs. */
const REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export const newTraceId = (): string => randomBytes(16).toString("hex");
export const newSpanId = (): string => randomBytes(8).toString("hex");

/** The trace id of a valid `traceparent` header (version 00), else null. */
export const parseTraceparent = (header: unknown): { traceId: string; parentSpanId: string } | null => {
  if (typeof header !== "string") return null;
  const match = TRACEPARENT.exec(header.trim().toLowerCase());
  if (!match || match[1] === ZERO_TRACE || match[2] === ZERO_SPAN) return null;
  return { traceId: match[1]!, parentSpanId: match[2]! };
};

export const formatTraceparent = ({ traceId, spanId }: Pick<OperationContext, "traceId" | "spanId">): string =>
  `00-${traceId}-${spanId}-01`;

/**
 * A context for one incoming request: the caller's trace is continued when it
 * sent a valid one, and its request id is kept when it is a plausible token -
 * anything else is replaced, so a header can never inject text into logs.
 */
export const contextFromHeaders = (headers: { traceparent?: unknown; requestId?: unknown }): OperationContext => {
  const parent = parseTraceparent(headers.traceparent);
  const requestId = typeof headers.requestId === "string" && REQUEST_ID.test(headers.requestId) ? headers.requestId : randomUUID();
  return { requestId, traceId: parent?.traceId ?? newTraceId(), spanId: newSpanId() };
};

/** A context for background work caused by something with a known trace. */
export const childContext = ({ traceId, requestId }: { traceId?: string | null; requestId?: string | null }): OperationContext => ({
  requestId: requestId && REQUEST_ID.test(requestId) ? requestId : randomUUID(),
  traceId: traceId && /^[0-9a-f]{32}$/.test(traceId) && traceId !== ZERO_TRACE ? traceId : newTraceId(),
  spanId: newSpanId(),
});
