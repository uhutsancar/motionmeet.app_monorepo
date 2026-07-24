export const BASEURL = (import.meta.env.VITE_BASEURL || "").replace(/\/$/, "");
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_BASEURL ||
  (typeof window !== "undefined" ? window.location.origin : "");

if (
  import.meta.env.PROD &&
  BASEURL &&
  !BASEURL.startsWith("https://")
) {
  throw new Error("VITE_BASEURL must use HTTPS in production.");
}
