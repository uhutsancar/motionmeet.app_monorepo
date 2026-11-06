import imagekit from "../configs/imageKit.js";
import { loadEnvironment } from "../configs/environment.js";
import { mediaUrlUnresolvable } from "../observability/metrics.js";
import { extractS3Key } from "../utils/s3Utils.js";

/**
 * Media URLs are built when a response is built, signed and time-limited
 * (WP-06 of the 2026-11 audit, ADR 003).
 *
 * They used to be built once, at upload, and stored: unsigned ImageKit URLs
 * with no expiry, whose path is the S3 object key itself. Whoever had seen one
 * kept access for ever - after the post was deleted, after the account went
 * private, after an unfollow. Now the stored URL is only a record; every read
 * signs the object key afresh, so a URL stops working at the end of its
 * window and a viewer who lost access cannot obtain a new one.
 *
 * ## Windows (D-02)
 *
 * Each purpose has a window `W` and a minimum remaining life `M`. A URL's
 * expiry is `ceil((now + M) / W) * W`: every request in the same window gets
 * the same expiry - and therefore byte-for-byte the same URL, which keeps
 * CDN, browser and app image caches effective - and a URL always has between
 * `M` and `W + M` left when it is handed out. Story URLs never outlive the
 * story.
 *
 * `M` (5 minutes at least) is longer than any response cache (feed 30 s,
 * nearby 45 s, profile 60 s), so a URL served from a cached page still has
 * minutes to run.
 */
export type MediaPurpose = "profiles" | "covers" | "posts" | "stories" | "messages" | "sharePreview";

interface DeliveryWindow { windowSeconds: number; minimumSeconds: number }
const HOUR = 3_600;
export const DELIVERY_WINDOWS: Readonly<Record<MediaPurpose, DeliveryWindow>> = Object.freeze({
  messages: { windowSeconds: HOUR, minimumSeconds: 5 * 60 },
  stories: { windowSeconds: HOUR, minimumSeconds: 5 * 60 },
  posts: { windowSeconds: 6 * HOUR, minimumSeconds: 15 * 60 },
  profiles: { windowSeconds: 24 * HOUR, minimumSeconds: HOUR },
  covers: { windowSeconds: 24 * HOUR, minimumSeconds: HOUR },
  // Link previews are fetched by social networks' bots, sometimes days after
  // the link was shared; only public posts of public accounts get one.
  sharePreview: { windowSeconds: 7 * 24 * HOUR, minimumSeconds: 24 * HOUR },
});

/** Per-purpose ImageKit transformations; videos are delivered as stored. */
const IMAGE_TRANSFORMATIONS: Readonly<Record<MediaPurpose, ReadonlyArray<Record<string, string>>>> = {
  profiles: [{ width: "512" }, { quality: "auto" }, { format: "webp" }],
  covers: [{ width: "1280" }, { quality: "auto" }, { format: "webp" }],
  posts: [{ quality: "auto" }, { format: "webp" }],
  messages: [{ quality: "auto" }, { format: "webp" }, { width: "1280" }],
  stories: [{ quality: "auto" }, { format: "webp" }],
  sharePreview: [{ width: "1200" }, { quality: "auto" }, { format: "jpg" }],
};

export const transformationsFor = (purpose: MediaPurpose, contentType = ""): Array<Record<string, string>> | undefined =>
  contentType.startsWith("video/") || contentType === "video" ? undefined : [...IMAGE_TRANSFORMATIONS[purpose]];

/** Seconds since the epoch at which a URL for `purpose` expires, when issued at `nowSeconds`. */
export const expiryFor = (purpose: MediaPurpose, nowSeconds: number, notAfter?: Date | null): number => {
  const { windowSeconds, minimumSeconds } = DELIVERY_WINDOWS[purpose];
  const aligned = Math.ceil((nowSeconds + minimumSeconds) / windowSeconds) * windowSeconds;
  // A story's media dies with the story, even if that leaves less than M.
  return notAfter ? Math.min(aligned, Math.floor(notAfter.getTime() / 1000)) : aligned;
};

/**
 * `MEDIA_SIGNED_DELIVERY=false` serves the stored URLs again. It is a rollback
 * switch for the rollout only: once ImageKit refuses unsigned URLs, turning it
 * off breaks every image.
 */
const signedDeliveryEnabled = (): boolean => loadEnvironment().mediaSignedDelivery;

const endpointHost = (): string | null => {
  try { return process.env.IMAGEKIT_URL_ENDPOINT ? new URL(process.env.IMAGEKIT_URL_ENDPOINT).host : null; } catch { return null; }
};

/** True for a URL MotionMeet itself delivered through ImageKit. */
const isOwnMediaUrl = (url: string): boolean => {
  try {
    const host = new URL(url).host;
    return host === endpointHost() || host === "ik.imagekit.io";
  } catch { return false; }
};

const urlExpiry = (url: string): number | null => {
  try { const value = new URL(url).searchParams.get("ik-t"); return value ? Number(value) : null; } catch { return null; }
};

/**
 * Signs `key` for `purpose`. The ImageKit SDK computes the expiry itself from
 * `expireSeconds` and its own clock reading; if that reading falls in the next
 * second the expiry - and the URL - would differ by one second from every
 * other URL in the window, so the call is repeated once. A one-second
 * difference after that is harmless.
 */
const signKey = (purpose: MediaPurpose, key: string, contentType: string, notAfter: Date | null | undefined, clock: () => number, width?: number): string => {
  const path = key.startsWith("/") ? key.slice(1) : key;
  const base = transformationsFor(purpose, contentType);
  const transformation = base && width ? [...base, { width: String(width) }] : base;
  const build = (): { url: string; expected: number } => {
    const nowSeconds = Math.floor(clock() / 1000);
    const expected = expiryFor(purpose, nowSeconds, notAfter);
    // Never `signed` without `expireSeconds`: the SDK would then sign for its
    // default expiry, 9999999999 - an unsigned URL in all but name.
    const expireSeconds = Math.max(expected - nowSeconds, 1);
    const url = imagekit!.url({ path, ...(transformation ? { transformation, transformationPosition: "query" as const } : {}), signed: true, expireSeconds });
    return { url, expected };
  };
  const first = build();
  if (urlExpiry(first.url) === first.expected) return first.url;
  return build().url;
};

export interface DeliveryInput {
  purpose: MediaPurpose;
  /** The stored object key, when the row has one. */
  key?: string | null;
  /** The URL stored at upload time: the fallback record, and the source of the key for old rows. */
  storedUrl?: string | null;
  /** MIME type or media kind (`image`/`video`) - videos are not transformed. */
  contentType?: string | null;
  /** Story expiry: no URL outlives it. */
  notAfter?: Date | null;
  /** A display width for images, signed into the URL (clients cannot add one to a signed URL). */
  width?: number;
}

export interface Delivered { url: string | null; unavailable: boolean }

/**
 * Every upload is stored as `<purpose>/<userId>/<file>` (mediaUploadService).
 * `extractS3Key` is lenient - from a bare endpoint URL it returns the endpoint
 * id - so a recovered key must look like one of ours before it is signed.
 */
const MEDIA_KEY_PATTERN = /^(profiles|covers|posts|stories|messages)\/[^/]+\/./;

/**
 * The URL to hand out for a stored medium:
 *
 * - nothing stored (a text story, a message without a photo) → `""`;
 * - signed delivery switched off, or ImageKit not configured (local
 *   development and tests, where uploads are refused anyway) → the stored URL;
 * - a URL on somebody else's host (seed data, an external avatar) → as is: it
 *   was never ours to protect;
 * - our medium with a resolvable key → a signed, expiring URL;
 * - our medium whose key cannot be recovered → `url: null, unavailable: true`.
 *   Never the unsigned URL: that would reopen exactly what signing closes.
 *   Counted in `motionmeet_media_url_unresolvable_total`;
 *   `scripts/backfillMediaKeys.ts` repairs such rows.
 *
 * `clock` exists for tests.
 */
export const deliverMedia = ({ purpose, key, storedUrl, contentType, notAfter, width }: DeliveryInput, clock: () => number = Date.now): Delivered => {
  const stored = storedUrl?.trim() || "";
  const objectKey = key?.trim() || "";
  if (!stored && !objectKey) return { url: "", unavailable: false };
  if (!signedDeliveryEnabled() || !imagekit) return stored ? { url: stored, unavailable: false } : { url: null, unavailable: true };
  if (!objectKey && !isOwnMediaUrl(stored)) return { url: stored, unavailable: false };
  const resolved = objectKey || extractS3Key(stored);
  if (!resolved || !MEDIA_KEY_PATTERN.test(resolved)) {
    mediaUrlUnresolvable.inc({ purpose });
    return { url: null, unavailable: true };
  }
  return { url: signKey(purpose, resolved, contentType ?? "", notAfter, clock, width), unavailable: false };
};

/** `deliverMedia`, for callers that only need the URL. */
export const deliveredMediaUrl = (input: DeliveryInput, clock: () => number = Date.now): string | null => deliverMedia(input, clock).url;

/**
 * Avatars and cover photos: a string either way, because every client already
 * treats an empty picture as "show the default avatar". An unresolvable one
 * is therefore served as "" rather than null.
 */
export const profileImageUrl = (storedUrl: string | null | undefined, key?: string | null, purpose: "profiles" | "covers" = "profiles"): string =>
  deliveredMediaUrl({ purpose, key, storedUrl }) ?? "";
