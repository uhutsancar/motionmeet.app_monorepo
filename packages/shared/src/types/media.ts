export type UploadPurpose = "profiles" | "covers" | "posts" | "stories" | "messages";

export interface UploadResponse {
  key: string;
  uploadUrl: string;
  expiresIn: number;
  headers: Record<string, string>;
}
