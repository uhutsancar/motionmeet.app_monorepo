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
let ffprobeAvailable: Promise<boolean> | null = null;

/** Whether ffprobe can run here; asked once. Only the media worker image ships it. */
const hasFfprobe = (): Promise<boolean> => {
  ffprobeAvailable ??= runFile(FFPROBE, ["-version"], { timeout: 5_000 }).then(() => true, () => {
    logger.warn("ffprobe_unavailable", { hint: "videos keep null duration and size; run the worker from the media-runtime image" });
    return false;
  });
  return ffprobeAvailable;
};

/**
 * Duration and display size of the video stored under `key`.
 *
 * ffprobe reads the object over a five-minute presigned URL, fetching only the
 * ranges it needs (the moov atom, wherever the encoder put it) - the file is
 * never downloaded whole. It is treated as a parser of untrusted input: https
 * only, bounded probe size and time, and a hard timeout. The URL carries a
 * signature, and execFile puts the whole command line into its error message,
 * so no error from here ever includes it.
 *
 * Returns null when there is no prober or the file is not a readable video;
 * throws (so the event is retried) only when the probe timed out.
 */
export const probeStoredVideo = async (key: string): Promise<VideoFacts | null> => {
  if (!(await hasFfprobe())) return null;
  const [{ GetObjectCommand }, { getSignedUrl }, s3Client] = await Promise.all([loadS3Commands(), loadS3Presigner(), getS3Client()]);
  const url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key }), { expiresIn: 300 });
  try {
    const { stdout } = await runFile(FFPROBE, [
      "-v", "error", "-protocol_whitelist", "https,tls,tcp", "-probesize", "5000000", "-analyzeduration", "5000000",
      "-print_format", "json", "-show_format", "-show_streams", url,
    ], { timeout: PROBE_TIMEOUT_MS, maxBuffer: 1024 * 1024, windowsHide: true });
    return videoFactsFromProbe(JSON.parse(stdout));
  } catch (error: unknown) {
    if (error && typeof error === "object" && "killed" in error && error.killed) throw new Error("ffprobe timed out");
    // Exit code only: the message would carry the signed URL.
    const exitCode = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    logger.warn("video_probe_failed", { exitCode });
    return null;
  }
};
