import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import path from "path";
import s3Client from "../configs/aws.js";
import imagekit from "../configs/imageKit.js";
import UploadReservation from "../models/UploadReservation.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import { deleteMediaOrQueue } from "./mediaDeletionService.js";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const STORY_TYPES = new Set([...IMAGE_TYPES, ...VIDEO_TYPES]);
const PURPOSES = {
  profiles: { maxBytes: 5 * 1024 * 1024, maxFiles: 1, types: IMAGE_TYPES },
  covers: { maxBytes: 5 * 1024 * 1024, maxFiles: 1, types: IMAGE_TYPES },
  posts: { maxBytes: 20 * 1024 * 1024, maxFiles: 4, types: STORY_TYPES },
  messages: { maxBytes: 5 * 1024 * 1024, maxFiles: 1, types: IMAGE_TYPES },
  stories: {
    maxBytes: 20 * 1024 * 1024,
    maxFiles: 1,
    types: STORY_TYPES,
  },
};

const transformedUrl = (purpose, key, contentType) => {
  // Ensure no leading slash to prevent double-slash in the generated URL
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  if (contentType.startsWith("video/")) {
    return imagekit.url({ path: cleanKey });
  }
  const transformations = {
    profiles: [{ width: "512" }, { quality: "auto" }, { format: "webp" }],
    covers: [{ width: "1280" }, { quality: "auto" }, { format: "webp" }],
    posts: [{ quality: "auto" }, { format: "webp" }],
    messages: [{ quality: "auto" }, { format: "webp" }, { width: "1280" }],
    stories: [{ quality: "auto" }, { format: "webp" }],
  };
  return imagekit.url({
    path: cleanKey,
    transformation: transformations[purpose],
    transformationPosition: "query",
  });
};

export const createUploadReservation = async ({
  userId,
  purpose,
  fileName,
  contentType,
  size,
}) => {
  if (process.env.MEDIA_UPLOADS_ENABLED === "false") {
    throw Object.assign(new Error("Media uploads are disabled"), {
      status: 503,
    });
  }
  const rules = PURPOSES[purpose];
  const numericSize = Number(size);
  if (
    !rules ||
    typeof fileName !== "string" ||
    !fileName.trim() ||
    fileName.length > 255 ||
    !rules.types.has(contentType) ||
    !Number.isSafeInteger(numericSize) ||
    numericSize < 1 ||
    numericSize > rules.maxBytes
  ) {
    return null;
  }
  if (!process.env.AWS_BUCKET_NAME || !imagekit) {
    const error = Object.assign(new Error("Media service is not configured"), {
      status: 503,
    });
    throw error;
  }

  const safeName = path
    .basename(fileName)
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .slice(-120);
  const key = `${purpose}/${userId}/${Date.now()}-${randomUUID()}-${safeName}`;
  const expiresIn = 5 * 60;
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: undefined,
    ContentLength: numericSize,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  await UploadReservation.create({
    key,
    userId,
    purpose,
    contentType,
    maxBytes: rules.maxBytes,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  return {
    key,
    uploadUrl,
    expiresIn,
    headers: { "Content-Type": contentType },
  };
};

const parseKeys = (value) => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.length > 8192) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [value];
  }
};

export const resolveReservedUploads = async (userId, purpose, value) => {
  const keys = parseKeys(value);
  const rules = PURPOSES[purpose];
  if (!keys || !rules || keys.length > rules.maxFiles) {
    const error = Object.assign(new Error("Invalid uploaded media references"), {
      status: 400,
    });
    throw error;
  }
  if (!keys.length) return [];
  if (process.env.MEDIA_UPLOADS_ENABLED === "false") {
    throw Object.assign(new Error("Media uploads are disabled"), {
      status: 503,
    });
  }
  if (keys.some((key) => typeof key !== "string" || key.length > 1024)) {
    const error = Object.assign(new Error("Invalid uploaded media reference"), {
      status: 400,
    });
    throw error;
  }

  const reservations = await UploadReservation.find({
    key: { $in: keys },
    userId,
    purpose,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (reservations.length !== keys.length) {
    const error = Object.assign(new Error("Uploaded media reference expired"), {
      status: 400,
    });
    throw error;
  }
  const reservationByKey = new Map(
    reservations.map((reservation) => [reservation.key, reservation])
  );

  const uploads = await Promise.all(
    keys.map(async (key) => {
      const reservation = reservationByKey.get(key);
      const head = await s3Client.send(
        new HeadObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
        })
      );
      if (
        !reservation ||
        Number(head.ContentLength) > reservation.maxBytes ||
        head.ContentType !== reservation.contentType ||
        !rules.types.has(head.ContentType)
      ) {
        const error = Object.assign(new Error("Uploaded media failed verification"), {
          status: 400,
        });
        throw error;
      }
      const sample = await s3Client.send(
        new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
          Range: "bytes=0-31",
        })
      );
      const signature = Buffer.from(await sample.Body.transformToByteArray());
      if (
        !hasValidMediaSignature({
          buffer: signature,
          mimetype: reservation.contentType,
        })
      ) {
        const error = Object.assign(new Error("Uploaded media content is invalid"), {
          status: 415,
        });
        throw error;
      }
      return {
        key,
        url: transformedUrl(purpose, key, reservation.contentType),
        contentType: reservation.contentType,
      };
    })
  );
  return uploads;
};

export const commitReservedUploads = async (keys) => {
  if (keys.length) await UploadReservation.deleteMany({ key: { $in: keys } });
};

export const discardReservedUploads = async (keys) => {
  if (!keys.length) return;
  await deleteMediaOrQueue(keys);
  await UploadReservation.deleteMany({ key: { $in: keys } });
};
