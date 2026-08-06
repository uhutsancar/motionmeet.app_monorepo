import api from './client';
import { API_ROUTES, type UploadPurpose, type UploadResponse } from '@motionmeet/shared';
import { isAxiosError } from 'axios';
import * as FileSystem from 'expo-file-system/legacy';

export interface MediaAsset {
  uri: string;
  mimeType?: string | null;
  type?: string | null;
  fileName?: string | null;
  name?: string | null;
  fileSize?: number | null;
  assetId?: string | null;
}

interface UserFacingError extends Error {
  userCode?: string;
  response?: unknown;
}

const extensionType = (uri = ''): string => {
  const extension = uri.split('.').pop()?.toLowerCase()?.split('?')[0];
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'webm') return 'video/webm';
  if (extension === 'mov') return 'video/quicktime';
  return 'image/jpeg';
};

const normalizeMimeType = (value: unknown): string => {
  const mimeType = String(value || '').toLowerCase();
  if (mimeType === 'image/jpg') return 'image/jpeg';
  return mimeType;
};

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const ascii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.slice(start, end));

const detectMediaType = async (blob: Blob): Promise<string | null> => {
  try {
    if (typeof blob?.slice !== 'function') return null;
    const sampleBlob = blob.slice(0, 32);
    if (typeof sampleBlob.arrayBuffer !== 'function') return null;

    const bytes = new Uint8Array(await sampleBlob.arrayBuffer());
    if (bytes.length < 12) return null;
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) return 'image/png';
    if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'image/gif';
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
    if (ascii(bytes, 4, 8) === 'ftyp') {
      const brand = ascii(bytes, 8, 12);
      if (/^(heic|heix|hevc|hevx|heim|heis)$/.test(brand)) return 'image/heic';
      if (/^(heif|mif1|msf1)$/.test(brand)) return 'image/heif';
      if (/^(avif|avis)$/.test(brand)) return null;
      if (brand === 'qt  ') return 'video/quicktime';
      return 'video/mp4';
    }
    return null;
  } catch {
    // Older Android Blob implementations may not expose arrayBuffer. The
    // picker-provided MIME type remains a safe fallback in that case.
    return null;
  }
};

const mediaError = (message: string, userCode = 'UNSUPPORTED_MEDIA_TYPE'): UserFacingError => {
  const error: UserFacingError = new Error(message);
  error.userCode = userCode;
  return error;
};

/** Uploads go straight to object storage, where an unreachable name or a stalled
 *  socket can leave the request hanging. Without a deadline the publish button
 *  spins forever and the user is never told anything, so the wait is cut short
 *  and reported as an ordinary failure instead. */
const UPLOAD_TIMEOUT_MS = 60_000;

const withDeadline = async <T>(work: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(mediaError(message, 'MEDIA_UPLOAD_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const uploadMedia = async (
  asset: MediaAsset,
  purpose: UploadPurpose,
  token: string,
): Promise<string> => {
  if (!asset?.uri) throw mediaError('A valid media file is required');
  // The file is read once to sniff its real type and measure it. The upload
  // itself streams from disk, so this blob never leaves the JS side.
  const localResponse = await fetch(asset.uri);
  if (!localResponse.ok) throw mediaError('Selected media could not be read');
  const body = await localResponse.blob();
  try {
    const detectedType = await detectMediaType(body);
    const declaredType = normalizeMimeType(
      asset.mimeType ||
      (asset.type?.includes('/') ? asset.type : null) ||
      body.type ||
      extensionType(asset.uri)
    );
    const contentType = detectedType || declaredType;
    if (!MIME_EXTENSIONS[contentType]) {
      throw mediaError('The selected media format is not supported');
    }

    const suppliedName = asset.fileName || asset.name;
    const suppliedBaseName = suppliedName?.replace(/\.[^.]+$/, '');
    const fileName = `${suppliedBaseName || `${purpose}-${Date.now()}`}.${MIME_EXTENSIONS[contentType]}`;
    // The presigned URL signs content-length, so it has to describe the bytes
    // actually being sent. The picker reports the size of the original asset,
    // which differs once it hands back a converted copy (an iOS HEIC arriving as
    // JPEG, for one) - signing that number makes S3 reject the upload with 403.
    const size = body.size || asset.fileSize || 0;

    const { data } = await api.post<UploadResponse>(
      API_ROUTES.media.presign,
      { purpose, fileName, contentType, size },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    // The file is streamed from disk by the native side rather than sent as a
    // JS Blob. Handing a Blob to fetch fails on Android with a bare "Network
    // request failed" - no status, no response - which is what made publishing
    // a photo spin forever with nothing to show the user.
    const uploadResponse = await withDeadline(
      FileSystem.uploadAsync(data.uploadUrl, asset.uri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: data.headers,
      }),
      UPLOAD_TIMEOUT_MS,
      'Media upload timed out. Check your connection and try again.',
    );
    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error(`Media upload failed (${uploadResponse.status})`);
    }
    return data.key;
  } catch (error: unknown) {
    if (error instanceof Error && 'userCode' in error && error.userCode) throw error;
    const responseData = isAxiosError(error) && typeof error.response?.data === 'object'
      ? error.response.data as { message?: string; error?: { code?: string } }
      : undefined;
    const wrappedError: UserFacingError = new Error(
      responseData?.message || (error instanceof Error ? error.message : 'Media upload failed')
    );
    wrappedError.userCode = responseData?.error?.code;
    wrappedError.response = isAxiosError(error) ? error.response : undefined;
    throw wrappedError;
  } finally {
    const closeableBody = body as Blob & { close?: () => void };
    closeableBody.close?.();
  }
};
