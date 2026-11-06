import sharp from "sharp";
import { getS3Client, loadS3Commands } from "../configs/aws.js";

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
