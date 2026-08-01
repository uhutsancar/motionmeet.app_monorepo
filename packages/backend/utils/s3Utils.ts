import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Readable } from "node:stream";
import s3Client from "../configs/aws.js";

export const createS3Key = (fileName: string, folder = ""): string => {
  const safeName = path.basename(fileName || "upload").replace(/[^A-Za-z0-9._-]/g, "-");
  const objectName = `${Date.now()}-${randomUUID()}-${safeName}`;
  return folder ? `${folder}/${objectName}` : objectName;
};

export const uploadToS3 = async (file: Buffer | Uint8Array | Readable, fileName: string, folder = "", contentType?: string, objectKey: string | null = null): Promise<{ key: string }> => {
  if (process.env.MEDIA_UPLOADS_ENABLED === "false") throw Object.assign(new Error("Media uploads are disabled"), { status: 503 });
  if (!process.env.AWS_BUCKET_NAME) throw Object.assign(new Error("AWS_BUCKET_NAME is not configured"), { status: 503 });
  const key = objectKey || createS3Key(fileName, folder);
  const upload = new Upload({ client: s3Client, params: { Bucket: process.env.AWS_BUCKET_NAME, Key: key, Body: file, ...(contentType ? { ContentType: contentType } : {}) } });
  await upload.done();
  return { key };
};

export const deleteFromS3 = async (s3Key: string): Promise<void> => {
  if (!s3Key) return;
  if (!process.env.AWS_BUCKET_NAME) throw new Error("AWS_BUCKET_NAME is not configured");
  if (s3Key.length > 1024 || s3Key.startsWith("/") || s3Key.split("/").includes("..")) throw Object.assign(new Error("Invalid S3 object key"), { code: "INVALID_S3_KEY" });
  await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: s3Key }));
};

export const extractS3Key = (url: unknown): string | null => {
  if (typeof url !== "string" || !url) return null;
  try {
    const parsed = new URL(url);
    const pathParts = decodeURIComponent(parsed.pathname).split("/").filter(Boolean);
    const knownFolders = new Set(["profiles", "covers", "posts", "stories", "messages"]);
    const folderIndex = pathParts.findIndex((part) => knownFolders.has(part));
    if (folderIndex >= 0) return pathParts.slice(folderIndex).join("/");
    const clean = pathParts.filter((part) => !part.startsWith("tr:"));
    if (parsed.host === "ik.imagekit.io" && clean.length > 1) return clean.slice(1).join("/");
    return clean.join("/") || null;
  } catch { return null; }
};
