export type UploadPurpose = "profiles" | "covers" | "posts" | "stories" | "messages";

export interface UploadResponse {
  key: string;
  uploadUrl: string;
  expiresIn: number;
  headers: Record<string, string>;
}

/**
 * The sizes an image is actually displayed at, named after where it is shown.
 *
 * Media is stored once at full resolution and delivered through ImageKit, which
 * resizes on the fly - but only when the URL asks it to. The stored URL asks
 * for `q-auto,f-webp` and nothing else, so a 4000x3000 photograph was being
 * downloaded in full to fill a 400-pixel feed card. These are the widths that
 * fill each surface on a high-density screen.
 */
export const MEDIA_WIDTHS = Object.freeze({
  /** Explore grid cell, comment avatar, exercise thumbnail. */
  thumb: 320,
  /** Profile picture wherever it appears next to a name. */
  avatar: 128,
  /** A feed or story card, full column width. */
  feed: 720,
  /** Full-screen viewer, profile cover, story canvas. */
  detail: 1440,
});

export type MediaVariant = keyof typeof MEDIA_WIDTHS;

const IMAGEKIT_HOST_PATTERN = /(^|\.)imagekit\.io$/i;
const VIDEO_EXTENSION_PATTERN = /\.(mp4|webm|mov|m4v)$/i;

/**
 * Rewrites a stored media URL to ask for a given display width.
 *
 * Only ImageKit URLs are touched. Anything else - a relative path, a bare S3
 * object, an empty string - comes back exactly as it went in, so a caller can
 * apply this unconditionally to whatever the API returned.
 *
 * Width is merged into the existing `tr` parameter rather than replacing it, so
 * the `q-auto` and `f-webp` the backend already asked for survive. A URL that
 * already names a width is left alone: that width was chosen deliberately, by
 * `mediaUploadService` for avatars and covers.
 */
export const mediaVariantUrl = (value: unknown, variant: MediaVariant): string => {
  if (typeof value !== "string" || !value.trim()) return typeof value === "string" ? value : "";
  const raw = value.trim();

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (!IMAGEKIT_HOST_PATTERN.test(url.hostname)) return raw;
  // Resizing does not apply to video, and asking for it produces a transform
  // ImageKit has to reject or re-encode.
  if (VIDEO_EXTENSION_PATTERN.test(url.pathname)) return raw;

  const existing = url.searchParams.get("tr");
  const parts = existing ? existing.split(",").map((part) => part.trim()).filter(Boolean) : [];
  if (parts.some((part) => part.startsWith("w-"))) return raw;

  parts.push(`w-${MEDIA_WIDTHS[variant]}`);
  url.searchParams.set("tr", parts.join(","));
  // ImageKit reads `tr` as a comma-separated list; percent-encoding the commas
  // would make it one unknown transformation instead of several known ones.
  return url.toString().replace(/([?&]tr=)([^&]*)/, (_match, prefix: string, list: string) => `${prefix}${list.replace(/%2C/gi, ",")}`);
};

/**
 * A `srcset` covering the variant asked for and the one above it, so a browser
 * on a dense display can pick the sharper file without every device paying for
 * it. Returns an empty string when the URL is not resizable, which is the
 * correct value to hand an `<img srcset>`.
 */
export const mediaSrcSet = (value: unknown, variant: MediaVariant): string => {
  const order: MediaVariant[] = ["avatar", "thumb", "feed", "detail"];
  const index = order.indexOf(variant);
  const next = order[index + 1];
  const base = mediaVariantUrl(value, variant);
  if (typeof value !== "string" || !base || base === value.trim() ) return "";
  const entries = [`${base} ${MEDIA_WIDTHS[variant]}w`];
  if (next) entries.push(`${mediaVariantUrl(value, next)} ${MEDIA_WIDTHS[next]}w`);
  return entries.join(", ");
};
