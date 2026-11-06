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

export interface UploadProgress {
  sentBytes: number;
  totalBytes: number;
}

export interface UploadOptions {
  /** Aborting cancels the native transfer, not only the promise. */
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
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

/** Enough leading bytes for every signature `detectMediaType` knows. */
const SIGNATURE_BYTES = 32;

const ascii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.slice(start, end));

export const detectMediaType = (bytes: Uint8Array): string | null => {
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
};

const decodeBase64 = (value: string): Uint8Array | null => {
  if (typeof globalThis.atob !== 'function') return null;
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

interface LocalFileFacts {
  size: number | null;
  head: Uint8Array | null;
}

/**
 * The file's size and first bytes, read from disk without loading the file.
 *
 * This used to `fetch(uri).blob()` - the whole photo or video copied into the
 * JS side just to read 32 bytes and a length, which for a 100 MB video is what
 * pushed low-memory Android devices over. Each fact is best-effort: a URI the
 * file-system module cannot stat (some content:// providers) falls back to the
 * picker's size, and a missing signature only skips the local sniff - the
 * server checks the real bytes either way.
 */
const readLocalFileFacts = async (uri: string): Promise<LocalFileFacts> => {
  const [info, head] = await Promise.all([
    FileSystem.getInfoAsync(uri).catch(() => null),
    FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: SIGNATURE_BYTES,
    }).then(decodeBase64).catch(() => null),
  ]);
  if (info && !info.exists) throw mediaError('Selected media could not be read');
  const size = info?.exists && typeof info.size === 'number' && info.size > 0 ? info.size : null;
  return { size, head };
};

const mediaError = (message: string, userCode = 'UNSUPPORTED_MEDIA_TYPE'): UserFacingError => {
  const error: UserFacingError = new Error(message);
  error.userCode = userCode;
  return error;
};

/**
 * Upload deadlines.
 *
 * A single fixed 60 s cap failed both ways: a 100 MB video on a slow but
 * healthy connection was cut off while still moving, and when the cap fired
 * the native transfer kept running in the background anyway. Now a transfer
 * that stops making progress for STALL_TIMEOUT_MS is cancelled, and the total
 * allowance grows with the file at a floor throughput, so nothing spins
 * forever and nothing healthy is killed.
 */
const STALL_TIMEOUT_MS = 30_000;
const BASE_DEADLINE_MS = 60_000;
const FLOOR_THROUGHPUT_BYTES_PER_SECOND = 32 * 1024;
const MAX_DEADLINE_MS = 30 * 60_000;

export const uploadDeadlineMs = (sizeBytes: number): number =>
  Math.min(MAX_DEADLINE_MS, BASE_DEADLINE_MS + Math.ceil((sizeBytes / FLOOR_THROUGHPUT_BYTES_PER_SECOND) * 1000));

const cancelledError = (): UserFacingError => mediaError('Media upload was cancelled', 'MEDIA_UPLOAD_CANCELLED');

/**
 * Streams the file from disk to the presigned URL, reporting progress and
 * cancelling the native task on abort, stall or deadline. Promise.race alone
 * would only stop waiting; the bytes would keep going.
 */
const transferFile = (
  uploadUrl: string,
  uri: string,
  headers: Record<string, string>,
  sizeBytes: number,
  { signal, onProgress }: UploadOptions,
): Promise<FileSystem.FileSystemUploadResult> => new Promise((resolve, reject) => {
  let settled = false;
  let task: FileSystem.UploadTask | null = null;
  const timers: { stall?: ReturnType<typeof setTimeout>; deadline?: ReturnType<typeof setTimeout> } = {};

  const onAbort = (): void => abortWith(cancelledError());
  const finish = (outcome: () => void): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timers.stall);
    clearTimeout(timers.deadline);
    signal?.removeEventListener('abort', onAbort);
    outcome();
  };
  const abortWith = (error: UserFacingError): void => {
    finish(() => reject(error));
    task?.cancelAsync().catch(() => undefined);
  };
  const armStallTimer = (): void => {
    clearTimeout(timers.stall);
    timers.stall = setTimeout(() => abortWith(mediaError(
      'Media upload stalled. Check your connection and try again.',
      'MEDIA_UPLOAD_TIMEOUT',
    )), STALL_TIMEOUT_MS);
  };

  if (signal?.aborted) { onAbort(); return; }
  task = FileSystem.createUploadTask(
    uploadUrl,
    uri,
    { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (settled) return;
      armStallTimer();
      onProgress?.({ sentBytes: totalBytesSent, totalBytes: totalBytesExpectedToSend || sizeBytes });
    },
  );
  signal?.addEventListener('abort', onAbort);
  armStallTimer();
  timers.deadline = setTimeout(() => abortWith(mediaError(
    'Media upload timed out. Check your connection and try again.',
    'MEDIA_UPLOAD_TIMEOUT',
  )), uploadDeadlineMs(sizeBytes));

  task.uploadAsync().then(
    (result) => finish(() => (result ? resolve(result) : reject(cancelledError()))),
    (error: unknown) => finish(() => reject(error)),
  );
});

export const uploadMedia = async (
  asset: MediaAsset,
  purpose: UploadPurpose,
  token: string,
  options: UploadOptions = {},
): Promise<string> => {
  if (!asset?.uri) throw mediaError('A valid media file is required');
  if (options.signal?.aborted) throw cancelledError();
  try {
    const facts = await readLocalFileFacts(asset.uri);
    const detectedType = facts.head ? detectMediaType(facts.head) : null;
    const declaredType = normalizeMimeType(
      asset.mimeType ||
      (asset.type?.includes('/') ? asset.type : null) ||
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
    // The size on disk is therefore preferred, and the picker's only used when
    // the file cannot be stat'ed.
    const size = facts.size || asset.fileSize || 0;
    if (!size) throw mediaError('Selected media could not be read');

    const { data } = await api.post<UploadResponse>(
      API_ROUTES.media.presign,
      { purpose, fileName, contentType, size },
      { headers: { Authorization: `Bearer ${token}` }, signal: options.signal }
    );
    // The file is streamed from disk by the native side rather than sent as a
    // JS Blob. Handing a Blob to fetch fails on Android with a bare "Network
    // request failed" - no status, no response - which is what made publishing
    // a photo spin forever with nothing to show the user.
    const uploadResponse = await transferFile(data.uploadUrl, asset.uri, data.headers, size, options);
    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error(`Media upload failed (${uploadResponse.status})`);
    }
    return data.key;
  } catch (error: unknown) {
    if (error instanceof Error && 'userCode' in error && error.userCode) throw error;
    if (options.signal?.aborted) throw cancelledError();
    const responseData = isAxiosError(error) && typeof error.response?.data === 'object'
      ? error.response.data as { message?: string; error?: { code?: string } }
      : undefined;
    const wrappedError: UserFacingError = new Error(
      responseData?.message || (error instanceof Error ? error.message : 'Media upload failed')
    );
    wrappedError.userCode = responseData?.error?.code;
    wrappedError.response = isAxiosError(error) ? error.response : undefined;
    throw wrappedError;
  }
};

/** True for the error `uploadMedia` throws when its signal was aborted. */
export const isUploadCancelled = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'userCode' in error && error.userCode === 'MEDIA_UPLOAD_CANCELLED');
