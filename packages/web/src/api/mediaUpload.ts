import axios from "axios";
import api from "./axios";
import { API_ROUTES, type ApiFailure } from "@motionmeet/shared";

export type UploadPurpose = "profiles" | "covers" | "posts" | "messages" | "stories";
interface UploadReservationResponse { success: boolean; key: string; uploadUrl: string; headers: Record<string, string>; expiresIn: number }

const PROFILE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const inferContentType = (file: File): string => {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "mp4") return "video/mp4";
  if (extension === "webm") return "video/webm";
  if (extension === "mov") return "video/quicktime";
  return "";
};

export const validateProfileImage = (file: File): string => {
  if (!(file instanceof File)) throw new Error("Please select a valid image.");
  const contentType = inferContentType(file);
  if (!PROFILE_IMAGE_TYPES.has(contentType)) {
    throw new Error("Use a JPG, PNG, WebP, GIF, HEIC or HEIF image.");
  }
  if (file.size < 1 || file.size > PROFILE_IMAGE_MAX_BYTES) {
    throw new Error("Profile images must be smaller than 5 MB.");
  }
  return contentType;
};

export const uploadMedia = async (file: File, purpose: UploadPurpose, token: string): Promise<string> => {
  if (!(file instanceof File)) throw new Error("A valid media file is required");
  const contentType = inferContentType(file);

  try {
    const { data } = await api.post<UploadReservationResponse>(
      API_ROUTES.media.presign,
      {
        purpose,
        fileName: file.name,
        contentType,
        size: file.size,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    await axios.put(data.uploadUrl, file, {
      headers: data.headers,
      timeout: 120000,
      maxBodyLength: Infinity,
    });
    return data.key;
  } catch (error: unknown) {
    const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
    throw new Error(
      failure?.message ||
      (axios.isAxiosError(error) && error.code === "ERR_NETWORK"
        ? "The media service could not be reached. Check the S3 CORS configuration."
        : error instanceof Error ? error.message : "Media upload failed.")
    );
  }
};
