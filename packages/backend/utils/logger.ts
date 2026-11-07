import { currentContext } from "../observability/context.js";

type Metadata = Record<string, unknown>;
export const safeErrorMetadata = (error: unknown): Metadata => {
  if (!error || typeof error !== "object") return {};
  const candidate = error as { name?: unknown; code?: unknown };
  return {
    ...(typeof candidate.name === "string" ? { errorName: candidate.name.slice(0, 80) } : {}),
    ...(typeof candidate.code === "string" || typeof candidate.code === "number" ? { errorCode: String(candidate.code).slice(0, 40) } : {}),
  };
};

/**
 * Masks what must never reach a log line even inside an error message: the
 * credentials and query string of a URL (a signed media URL is its query
 * string), e-mail addresses and bearer tokens.
 */
export const redactLogText = (text: string): string => text
  .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@"']+@/gi, "$1[redacted]@")
  .replace(/\b(https?:\/\/[^\s?#"']+)\?[^\s"'`]*/gi, "$1?[redacted]")
  .replace(/[^\s@"'<>(),;:]+@[^\s@"'<>(),;:/]+\.[a-z]{2,}/gi, "[email]")
  .replace(/\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]+/g, "[token]");

const MAX_MESSAGE = 500;
const MAX_STACK = 4_000;

/**
 * What an operator needs to find the cause of a failure that is ours: name
 * and code, message and stack, masked by `redactLogText`. PostgreSQL errors
 * add the constraint, table and column they name - never `detail`, which
 * quotes row values. Server logs only; none of it is sent to a client.
 *
 * Production used to log name and code alone, so a 500 said nothing about
 * where it came from. Expected, noisy failures (a dropped connection, a
 * refused token) stay with `safeErrorMetadata`.
 */
export const errorDiagnostics = (error: unknown): Metadata => {
  if (error === undefined || error === null) return {};
  if (typeof error !== "object") return { errorMessage: redactLogText(String(error)).slice(0, MAX_MESSAGE) };
  const candidate = error as { message?: unknown; stack?: unknown; constraint?: unknown; table?: unknown; column?: unknown; cause?: unknown };
  const text = (value: unknown, limit: number): string | undefined => (typeof value === "string" && value ? redactLogText(value).slice(0, limit) : undefined);
  const cause = candidate.cause && typeof candidate.cause === "object" ? safeErrorMetadata(candidate.cause) : {};
  const details: Metadata = {
    ...safeErrorMetadata(error),
    errorMessage: text(candidate.message, MAX_MESSAGE),
    stack: text(candidate.stack, MAX_STACK),
    constraint: text(candidate.constraint, 120),
    table: text(candidate.table, 120),
    column: text(candidate.column, 120),
    causeName: cause.errorName,
    causeCode: cause.errorCode,
  };
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
};

const write =(level: "info" | "warn" | "error", message: string, metadata: Metadata = {}): void => {
  // Every line written while serving a request or an event carries its ids, so
  // one search by trace id finds the API line, the outbox publish and the
  // worker line that one tap produced.
  const context = currentContext();
  const correlation = context ? { requestId: context.requestId, traceId: context.traceId } : {};
  const output = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...correlation, ...metadata });
  if (level === "error") console.error(output); else if (level === "warn") console.warn(output); else console.log(output);
};
export const logger = { info: (message: string, metadata?: Metadata): void => write("info", message, metadata), warn: (message: string, metadata?: Metadata): void => write("warn", message, metadata), error: (message: string, metadata?: Metadata): void => write("error", message, metadata) };
