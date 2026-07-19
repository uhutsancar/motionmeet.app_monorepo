import multer from "multer";

const storage = multer.memoryStorage();
const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const STORY_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, "video/mp4", "video/webm", "video/quicktime"]);

const createFileFilter = (allowedTypes) => (req, file, callback) => {
  if (!allowedTypes.has(file.mimetype)) {
    const error = Object.assign(new Error("Unsupported media type"), { status: 415 });
    return callback(error);
  }

  return callback(null, true);
};

export const imageUpload = multer({
  storage,
  fileFilter: createFileFilter(IMAGE_MIME_TYPES),
  limits: { fileSize: 5 * 1024 * 1024, files: 4, fields: 20 },
});

export const storyMediaUpload = multer({
  storage,
  fileFilter: createFileFilter(STORY_MIME_TYPES),
  limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 10 },
});

// Backward-compatible alias for any local integration importing `upload`.
export const upload = imageUpload;
