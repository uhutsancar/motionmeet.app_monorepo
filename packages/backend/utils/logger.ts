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
const write = (level: "info" | "warn" | "error", message: string, metadata: Metadata = {}): void => {
  // Every line written while serving a request or an event carries its ids, so
  // one search by trace id finds the API line, the outbox publish and the
  // worker line that one tap produced.
  const context = currentContext();
  const correlation = context ? { requestId: context.requestId, traceId: context.traceId } : {};
  const output = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...correlation, ...metadata });
  if (level === "error") console.error(output); else if (level === "warn") console.warn(output); else console.log(output);
};
export const logger = { info: (message: string, metadata?: Metadata): void => write("info", message, metadata), warn: (message: string, metadata?: Metadata): void => write("warn", message, metadata), error: (message: string, metadata?: Metadata): void => write("error", message, metadata) };
