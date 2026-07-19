export const BASEURL = (import.meta.env.VITE_BASEURL || "").replace(/\/$/, "");
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_BASEURL;
