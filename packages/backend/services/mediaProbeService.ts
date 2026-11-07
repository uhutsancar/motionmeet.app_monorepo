import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { getS3Client, loadS3Commands, loadS3Presigner } from "../configs/aws.js";
import { logger } from "../utils/logger.js";

const runFile = promisify(execFile);

/**
 * Pixel dimensions of stored images, measured by the media worker after the
 * post is already live - never on the request path.
 *
 * Only the head of the object is fetched: every format the upload rules allow
 * declares its size in its first few kilobytes, except a JPEG carrying a large
 * EXIF block or embedded thumbnail ahead of its frame header. For those the
 * whole file is read instead, but only up to IMAGE_FULL_READ_LIMIT; anything
 * larger keeps null dimensions rather than pulling a huge object through the
 * worker's memory.
 */
const HEAD_BYTES = 256 * 1024;
const IMAGE_FULL_READ_LIMIT = 25 * 1024 * 1024;
/** Same decompression-bomb ceiling the share-card renderer applies. */
const MAX_PIXELS = 100_000_000;

export interface ImageDimensions { width: number; height: number }

/**
 * Display dimensions from an image's header bytes, or null if they cannot be
 * read. EXIF orientations 5-8 rotate the picture a quarter turn, so the stored
 * width and height are swapped to describe what a viewer actually sees.
 */
export const imageDimensionsFromBuffer = async (buffer: Buffer): Promise<ImageDimensions | null> => {
  try {
    const metadata = await sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "none" }).metadata();
    if (!metadata.width || !metadata.height) return null;
    const rotated = typeof metadata.orientation === "number" && metadata.orientation >= 5;
    return rotated ? { width: metadata.height, height: metadata.width } : { width: metadata.width, height: metadata.height };
  } catch {
    return null;
  }
};

const readObject = async (key: string, range?: string): Promise<{ bytes: Buffer; totalBytes: number | null }> => {
  const [{ GetObjectCommand }, s3Client] = await Promise.all([loadS3Commands(), getS3Client()]);
  const response = await s3Client.send(new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key, ...(range ? { Range: range } : {}) }));
  if (!response.Body) throw new Error("Stored object has no body");
  const bytes = Buffer.from(await response.Body.transformToByteArray());
  // "bytes 0-262143/1234567" for a ranged read; ContentLength otherwise.
  const total = response.ContentRange ? Number(response.ContentRange.split("/")[1]) : Number(response.ContentLength);
  return { bytes, totalBytes: Number.isSafeInteger(total) ? total : null };
};

/** Dimensions of the image stored under `key`; null when they cannot be determined within the limits above. */
export const probeStoredImage = async (key: string): Promise<ImageDimensions | null> => {
  const head = await readObject(key, `bytes=0-${HEAD_BYTES - 1}`);
  const fromHead = await imageDimensionsFromBuffer(head.bytes);
  if (fromHead) return fromHead;
  if (head.totalBytes === null || head.totalBytes <= head.bytes.length || head.totalBytes > IMAGE_FULL_READ_LIMIT) return null;
  return imageDimensionsFromBuffer((await readObject(key)).bytes);
};

export interface VideoFacts { width: number; height: number; durationSeconds: number }

interface ProbeStream { codec_type?: unknown; width?: unknown; height?: unknown; duration?: unknown; tags?: { rotate?: unknown }; side_data_list?: Array<{ rotation?: unknown }> }

const quarterTurned = (stream: ProbeStream): boolean => {
  const fromSideData = stream.side_data_list?.find((entry) => typeof entry.rotation === "number")?.rotation;
  const rotation = Number(fromSideData ?? stream.tags?.rotate ?? 0);
  return Number.isFinite(rotation) && Math.abs(rotation) % 180 === 90;
};

/**
 * Display size and duration from `ffprobe -print_format json -show_format
 * -show_streams` output, or null when it describes no usable video stream.
 * A phone video recorded in portrait is usually stored landscape with a 90°
 * rotation; the size is swapped to what a viewer sees, as for images.
 */
export const videoFactsFromProbe = (probe: unknown): VideoFacts | null => {
  if (!probe || typeof probe !== "object") return null;
  const { streams, format } = probe as { streams?: ProbeStream[]; format?: { duration?: unknown } };
  const stream = Array.isArray(streams) ? streams.find((candidate) => candidate.codec_type === "video") : undefined;
  const width = Number(stream?.width);
  const height = Number(stream?.height);
  const durationSeconds = Number(stream?.duration ?? format?.duration);
  if (!stream || !(width > 0) || !(height > 0) || !(durationSeconds > 0) || !Number.isFinite(durationSeconds)) return null;
  const turned = quarterTurned(stream);
  return { width: turned ? height : width, height: turned ? width : height, durationSeconds: Math.round(durationSeconds * 1000) / 1000 };
};

const FFPROBE = process.env.FFPROBE_PATH?.trim() || "ffprobe";
const PROBE_TIMEOUT_MS = 30_000;

/**
 * A failure that says nothing about the file - storage or network trouble, a
 * timeout. The event is retried (and ends in `.dead`, visible, if it never
 * recovers) rather than recorded as done with no metadata.
 */
export class TransientMediaError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "TransientMediaError";
  }
}

const TRANSIENT_STDERR = /server returned (5\d\d|5xx|403|404)|http error (5\d\d|403|404)|\b(403 forbidden|404 not found)\b|connection (refused|reset|timed out)|timed out|network is unreachable|temporary failure in name resolution|failed to resolve hostname|i\/o error|end of file/i;
const PERMANENT_STDERR = /invalid data found when processing input|moov atom not found|could not find codec parameters|no such stream|unsupported codec/i;

/**
 * Sorts an ffprobe failure by its stderr. Only failures that are the file's
 * own fault are permanent; anything else - including an error nobody
 * recognises - is retried, because "done" with null metadata would be
 * silent and final. The stderr is read for this only and never stored or
 * logged: it can contain the signed URL.
 */
export const classifyProbeFailure = (stderr: string): "transient" | "permanent" => {
  if (TRANSIENT_STDERR.test(stderr)) return "transient";
  if (PERMANENT_STDERR.test(stderr)) return "permanent";
  return "transient";
};

/**
 * Whether ffprobe can run here. Only the media worker image ships it. A
 * positive answer is kept for the life of the process; a negative one only for
 * a minute (NEW-10: it used to be kept for ever, so a worker started without
 * ffprobe marked every video event done until it was restarted).
 */
const ffprobeChecks = new Map<string, { available: boolean; until: number }>();
export const hasFfprobe = async (binary = FFPROBE): Promise<boolean> => {
  const known = ffprobeChecks.get(binary);
  if (known && (known.available || known.until > Date.now())) return known.available;
  const available = await runFile(binary, ["-version"], { timeout: 5_000, windowsHide: true }).then(() => true, () => false);
  ffprobeChecks.set(binary, { available, until: Date.now() + 60_000 });
  return available;
};

/** Logged at start-up by processes that apply `media.uploaded` events. */
export const reportVideoProbeAvailability = async (): Promise<boolean> => {
  const available = await hasFfprobe();
  if (!available) logger.error("ffprobe_unavailable", { hint: "video events will fail and retry until ffprobe is present; run the worker from the media-runtime image" });
  return available;
};

type Runner = (file: string, args: string[], options: { timeout: number; maxBuffer: number; windowsHide: boolean }) => Promise<{ stdout: string; stderr?: string }>;

/**
 * Probes the video at `url` (a presigned URL; see `probeStoredVideo`).
 * Returns the facts, or null when the file is not a readable video; throws
 * `TransientMediaError` when the failure is not the file's fault.
 *
 * execFile puts the whole command line - the signed URL - into its error
 * message, and ffprobe repeats it on stderr, so neither is ever logged: only
 * the exit code and the classification are.
 */
export const probeVideoUrl = async (url: string, run: Runner = runFile as unknown as Runner, binary = FFPROBE): Promise<VideoFacts | null> => {
  let stdout: string;
  try {
    ({ stdout } = await run(binary, [
      "-v", "error", "-protocol_whitelist", "https,tls,tcp", "-probesize", "5000000", "-analyzeduration", "5000000",
      "-print_format", "json", "-show_format", "-show_streams", url,
    ], { timeout: PROBE_TIMEOUT_MS, maxBuffer: 1024 * 1024, windowsHide: true }));
  } catch (error: unknown) {
    const failure = error && typeof error === "object" ? error as { killed?: unknown; code?: unknown; stderr?: unknown } : {};
    if (failure.killed) throw new TransientMediaError("video_probe_timeout");
    const classification = classifyProbeFailure(typeof failure.stderr === "string" ? failure.stderr : "");
    logger.warn("video_probe_failed", { exitCode: failure.code === undefined ? "unknown" : String(failure.code), classification });
    if (classification === "transient") throw new TransientMediaError("video_probe_transient");
    return null;
  }
  try {
    return videoFactsFromProbe(JSON.parse(stdout));
  } catch {
    logger.warn("video_probe_failed", { exitCode: "0", classification: "permanent" });
    return null;
  }
};

/**
 * Duration and display size of the video stored under `key`.
 *
 * ffprobe reads the object over a five-minute presigned URL, fetching only the
 * ranges it needs (the moov atom, wherever the encoder put it) - the file is
 * never downloaded whole. It is treated as a parser of untrusted input: https
 * only, bounded probe size and time, and a hard timeout.
 *
 * Returns null only when the file is not a readable video. Throws when there
 * is no ffprobe here (the event then ends in `.dead`, visible, instead of being
 * recorded as done) and, via `TransientMediaError`, when the failure is not
 * the file's fault.
 */
export const probeStoredVideo = async (key: string, binary = FFPROBE): Promise<VideoFacts | null> => {
  if (!(await hasFfprobe(binary))) throw new Error("ffprobe_unavailable");
  const [{ GetObjectCommand }, { getSignedUrl }, s3Client] = await Promise.all([loadS3Commands(), loadS3Presigner(), getS3Client()]);
  const url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key }), { expiresIn: 300 });
  return probeVideoUrl(url, undefined, binary);
};
