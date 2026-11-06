/**
 * Fetching a remote image on the server, within limits.
 *
 * Used where the server has to pull a picture down mid-request (the photo a
 * share card is laid over). Every URL it is given today was built by this
 * server from an ImageKit object key, but older rows were imported, and a
 * fetch from inside the network is the one place a bad URL turns into a
 * request to something private. So the origin is checked against the media
 * hosts this server actually uses, redirects are refused rather than followed
 * somewhere unchecked, and the body is read in chunks so an oversized
 * response is cut off at the limit instead of being buffered whole first.
 */

/** Hosts a media URL may point at: the configured ImageKit endpoint, plus extras. */
export const allowedMediaHosts = (env: NodeJS.ProcessEnv = process.env): Set<string> => {
  const hosts = new Set<string>();
  for (const value of [env.IMAGEKIT_URL_ENDPOINT, ...(env.MEDIA_FETCH_ALLOWED_HOSTS ?? "").split(",")]) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    try {
      hosts.add(new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).host.toLowerCase());
    } catch {
      // A malformed entry allows nothing.
    }
  }
  return hosts;
};

/** Whether `raw` is an https URL, without credentials, on one of `hosts`. */
export const isAllowedMediaUrl = (raw: string, hosts: Set<string>): boolean => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  return hosts.has(url.host.toLowerCase());
};

export interface BoundedFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  hosts?: Set<string>;
  fetchImpl?: typeof fetch;
}

/**
 * The body of `url` as a Buffer, or null when the URL is not allowed, the
 * response is not a 2xx image, it redirects, it times out, or it is larger
 * than `maxBytes` - whatever its Content-Length claims.
 */
export const fetchImageBounded = async (url: string, options: BoundedFetchOptions): Promise<Buffer | null> => {
  const { maxBytes, timeoutMs, hosts = allowedMediaHosts(), fetchImpl = fetch } = options;
  if (!isAllowedMediaUrl(url, hosts)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: "error" });
    if (!response.ok || !response.body) return null;
    const type = response.headers.get("content-type") ?? "";
    if (type && !type.toLowerCase().startsWith("image/")) return null;
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maxBytes) return null;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
