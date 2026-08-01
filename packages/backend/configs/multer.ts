import type { Request } from "express";
import multer, { type FileFilterCallback } from "multer";
const storage = multer.memoryStorage();
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const STORY_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, "video/mp4", "video/webm", "video/quicktime"]);
const createFileFilter = (allowedTypes: Set<string>) => (_request: Request, file: Express.Multer.File, callback: FileFilterCallback): void => {
  if (!allowedTypes.has(file.mimetype)) return callback(Object.assign(new Error("Unsupported media type"), { status: 415 }));
  callback(null, true);
};
export const imageUpload = multer({ storage, fileFilter: createFileFilter(IMAGE_MIME_TYPES), limits: { fileSize: 5 * 1024 * 1024, files: 4, fields: 20 } });
export const storyMediaUpload = multer({ storage, fileFilter: createFileFilter(STORY_MIME_TYPES), limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 10 } });
export const postMediaUpload = multer({ storage, fileFilter: createFileFilter(STORY_MIME_TYPES), limits: { fileSize: 20 * 1024 * 1024, files: 4, fields: 20 } });
export const upload = imageUpload;
