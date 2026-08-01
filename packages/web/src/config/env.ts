const trimTrailingSlash = (value = ""): string => value.replace(/\/$/, "");
const isLoopbackHost = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "[::1]" ||
  hostname === "::1";

/**
 * Keep every local browser request on the same site. A page opened at
 * 127.0.0.1 with an API configured as localhost is cross-site for cookies,
 * so a SameSite=Lax refresh cookie will not be included after a reload.
 */
const alignLocalApiHost = (value: string): string => {
  const normalized = trimTrailingSlash(value);
  if (
    !normalized ||
    import.meta.env.PROD ||
    typeof window === "undefined" ||
    !isLoopbackHost(window.location.hostname)
  ) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    if (isLoopbackHost(url.hostname)) {
      url.hostname = window.location.hostname;
      return trimTrailingSlash(url.toString());
    }
  } catch {
    // Relative same-origin URLs do not need host alignment.
  }

  return normalized;
};

export const BASEURL = alignLocalApiHost(import.meta.env.VITE_BASEURL || "");
export const SOCKET_URL = alignLocalApiHost(
  import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_BASEURL ||
    (typeof window !== "undefined" ? window.location.origin : "")
);

if (
  import.meta.env.PROD &&
  BASEURL &&
  !BASEURL.startsWith("https://")
) {
  throw new Error("VITE_BASEURL must use HTTPS in production.");
}
