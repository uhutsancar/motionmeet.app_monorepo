import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { database, withTransaction, type DatabaseTransaction } from "../configs/database.js";
import s3Client from "../configs/aws.js";
import imagekit from "../configs/imageKit.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import { createS3Key, uploadToS3 } from "../utils/s3Utils.js";
import { processMediaDeletionJobs, queueMediaDeletions } from "./mediaDeletionService.js";

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const STORY_TYPES = new Set([...IMAGE_TYPES, ...VIDEO_TYPES]);
export type UploadPurpose = "profiles" | "covers" | "posts" | "messages" | "stories";
interface PurposeRules { maxBytes: number; maxFiles: number; types: Set<string> }
const PURPOSES: Record<UploadPurpose, PurposeRules> = {
  profiles: { maxBytes: 5 * 1024 * 1024, maxFiles: 1, types: IMAGE_TYPES }, covers: { maxBytes: 5 * 1024 * 1024, maxFiles: 1, types: IMAGE_TYPES },
  posts: { maxBytes: 100 * 1024 * 1024, maxFiles: 4, types: STORY_TYPES }, messages: { maxBytes: 5 * 1024 * 1024, maxFiles: 1, types: IMAGE_TYPES },
  stories: { maxBytes: 100 * 1024 * 1024, maxFiles: 1, types: STORY_TYPES },
};
const isPurpose = (value: unknown): value is UploadPurpose => typeof value === "string" && value in PURPOSES;

const transformedUrl = (purpose: UploadPurpose, key: string, contentType: string): string => {
  if (!imagekit) throw Object.assign(new Error("Media service is not configured"), { status: 503 });
  const cleanKey = key.startsWith("/") ? key.slice(1) : key;
  if (contentType.startsWith("video/")) return imagekit.url({ path: cleanKey });
  const transformations: Record<UploadPurpose, Array<Record<string, string>>> = {
    profiles: [{ width: "512" }, { quality: "auto" }, { format: "webp" }], covers: [{ width: "1280" }, { quality: "auto" }, { format: "webp" }],
    posts: [{ quality: "auto" }, { format: "webp" }], messages: [{ quality: "auto" }, { format: "webp" }, { width: "1280" }], stories: [{ quality: "auto" }, { format: "webp" }],
  };
  return imagekit.url({ path: cleanKey, transformation: transformations[purpose], transformationPosition: "query" });
};

interface ReservationInput { userId: string; purpose: unknown; fileName: unknown; contentType: unknown; size: unknown; maxUploadMb?: unknown }
export const createUploadReservation = async ({ userId, purpose, fileName, contentType, size, maxUploadMb = -1 }: ReservationInput) => {
  if (process.env.MEDIA_UPLOADS_ENABLED === "false") throw Object.assign(new Error("Media uploads are disabled"), { status: 503 });
  if (!isPurpose(purpose) || typeof contentType !== "string") return null;
  const rules = PURPOSES[purpose]; const numericSize = Number(size); const planLimit = Number(maxUploadMb);
  const effectiveMaxBytes = Math.min(rules.maxBytes, Number.isFinite(planLimit) && planLimit >= 0 ? planLimit * 1024 * 1024 : rules.maxBytes);
  if (typeof fileName !== "string" || !fileName.trim() || fileName.length > 255 || !rules.types.has(contentType) || !Number.isSafeInteger(numericSize) || numericSize < 1 || numericSize > effectiveMaxBytes) return null;
  if (!process.env.AWS_BUCKET_NAME || !imagekit) throw Object.assign(new Error("Media service is not configured"), { status: 503 });
  const safeName = path.basename(fileName).replace(/[^A-Za-z0-9._-]/g, "-").slice(-120);
  const key = `${purpose}/${userId}/${Date.now()}-${randomUUID()}-${safeName}`; const expiresIn = 300;
  const uploadUrl = await getSignedUrl(s3Client, new PutObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key, Body: undefined, ContentLength: numericSize, ContentType: contentType }), { expiresIn });
  await database.insertInto("upload_reservations").values({ legacy_mongo_id: null, object_key: key, user_id: userId, purpose, content_type: contentType, max_bytes: effectiveMaxBytes, expires_at: new Date(Date.now() + 3_600_000) }).execute();
  return { key, uploadUrl, expiresIn, headers: { "Content-Type": contentType } };
};

const parseKeys = (value: unknown): unknown[] | null => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.length > 8192) return null;
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed : [parsed]; } catch { return [value]; }
};

export interface ResolvedUpload { key: string; url: string; contentType: string }
export const resolveReservedUploads = async (userId: string, purposeValue: unknown, value: unknown): Promise<ResolvedUpload[]> => {
  const keys = parseKeys(value);
  if (!isPurpose(purposeValue) || !keys || keys.length > PURPOSES[purposeValue].maxFiles || keys.some((key) => typeof key !== "string" || key.length > 1024)) throw Object.assign(new Error("Invalid uploaded media references"), { status: 400 });
  const stringKeys = keys as string[]; if (!stringKeys.length) return [];
  const purpose = purposeValue; const rules = PURPOSES[purpose];
  const reservations = await database.selectFrom("upload_reservations").selectAll().where("object_key", "in", stringKeys).where("user_id", "=", userId).where("purpose", "=", purpose).where("expires_at", ">", new Date()).execute();
  if (reservations.length !== stringKeys.length) throw Object.assign(new Error("Uploaded media reference expired"), { status: 400 });
  const byKey = new Map(reservations.map((row) => [row.object_key, row]));
  return Promise.all(stringKeys.map(async (key) => {
    const reservation = byKey.get(key);
    const head = await s3Client.send(new HeadObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key }));
    if (!reservation || Number(head.ContentLength) > reservation.max_bytes || head.ContentType !== reservation.content_type || !head.ContentType || !rules.types.has(head.ContentType)) throw Object.assign(new Error("Uploaded media failed verification"), { status: 400 });
    const sample = await s3Client.send(new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key, Range: "bytes=0-31" }));
    if (!sample.Body) throw Object.assign(new Error("Uploaded media content is unavailable"), { status: 400 });
    const signature = Buffer.from(await sample.Body.transformToByteArray());
    if (!hasValidMediaSignature({ buffer: signature, mimetype: reservation.content_type })) throw Object.assign(new Error("Uploaded media content is invalid"), { status: 415 });
    return { key, url: transformedUrl(purpose, key, reservation.content_type), contentType: reservation.content_type };
  }));
};

interface DirectUpload { file: Buffer; fileName: string; userId: string; purpose: UploadPurpose; contentType: string }
export const uploadAndReserve = async ({ file, fileName, userId, purpose, contentType }: DirectUpload): Promise<{ key: string }> => {
  const rules = PURPOSES[purpose];
  if (!rules?.types.has(contentType)) throw Object.assign(new Error("Invalid media upload purpose"), { status: 400 });
  const key = createS3Key(fileName, purpose);
  await database.insertInto("upload_reservations").values({ legacy_mongo_id: null, object_key: key, user_id: userId, purpose, content_type: contentType, max_bytes: rules.maxBytes, expires_at: new Date(Date.now() + 3_600_000) }).execute();
  try { await uploadToS3(file, fileName, purpose, contentType, key); } catch (error: unknown) { await discardReservedUploads([key]); throw error; }
  return { key };
};

export const commitReservedUploads = async (keys: readonly unknown[], { transaction, userId }: { transaction?: DatabaseTransaction; userId?: string | null } = {}): Promise<void> => {
  const uniqueKeys = [...new Set(keys.filter((key): key is string => typeof key === "string" && Boolean(key)))];
  if (!uniqueKeys.length) return;
  const executor = transaction ?? database;
  let query = executor.deleteFrom("upload_reservations").where("object_key", "in", uniqueKeys);
  if (userId) query = query.where("user_id", "=", userId);
  const deleted = await query.returning("object_key").execute();
  if (deleted.length !== uniqueKeys.length) throw Object.assign(new Error("Upload reservation expired before database commit"), { status: 409 });
};

export const discardReservedUploads = async (keys: readonly unknown[]): Promise<void> => {
  const uniqueKeys = [...new Set(keys.filter((key): key is string => typeof key === "string" && Boolean(key)))];
  if (!uniqueKeys.length) return;
  const discarded = await withTransaction(async (transaction) => {
    const rows = await transaction.selectFrom("upload_reservations").select("object_key").where("object_key", "in", uniqueKeys).execute();
    const found = rows.map((row) => row.object_key);
    await queueMediaDeletions(found, { transaction });
    if (found.length) await transaction.deleteFrom("upload_reservations").where("object_key", "in", found).execute();
    return found;
  });
  if (discarded.length) await processMediaDeletionJobs({ limit: discarded.length, keys: discarded });
};
