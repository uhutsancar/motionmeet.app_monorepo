type Metadata = Record<string, unknown>;
const write = (level: "info" | "warn" | "error", message: string, metadata: Metadata = {}): void => {
  const output = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...metadata });
  if (level === "error") console.error(output); else if (level === "warn") console.warn(output); else console.log(output);
};
export const logger = { info: (message: string, metadata?: Metadata): void => write("info", message, metadata), warn: (message: string, metadata?: Metadata): void => write("warn", message, metadata), error: (message: string, metadata?: Metadata): void => write("error", message, metadata) };
