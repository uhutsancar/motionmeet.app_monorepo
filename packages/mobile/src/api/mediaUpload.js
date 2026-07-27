import api from './client';
import { API_ROUTES } from '@motionmeet/shared';

const extensionType = (uri = '') => {
  const extension = uri.split('.').pop()?.toLowerCase()?.split('?')[0];
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'webm') return 'video/webm';
  if (extension === 'mov') return 'video/quicktime';
  return 'image/jpeg';
};

const normalizeMimeType = (value) => {
  const mimeType = String(value || '').toLowerCase();
  if (mimeType === 'image/jpg') return 'image/jpeg';
  return mimeType;
};

const MIME_EXTENSIONS = {
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

const ascii = (bytes, start, end) =>
  String.fromCharCode(...bytes.slice(start, end));

const detectMediaType = async (blob) => {
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

const mediaError = (message, userCode = 'UNSUPPORTED_MEDIA_TYPE') => {
  const error = new Error(message);
  error.userCode = userCode;
  return error;
};

export const uploadMedia = async (asset, purpose, token) => {
  if (!asset?.uri) throw mediaError('A valid media file is required');
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
    const size = asset.fileSize || body.size;

    const { data } = await api.post(
      API_ROUTES.media.presign,
      { purpose, fileName, contentType, size },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const uploadResponse = await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: data.headers,
      body,
    });
    if (!uploadResponse.ok) {
      throw new Error(`Media upload failed (${uploadResponse.status})`);
    }
    return data.key;
  } catch (error) {
    if (error.userCode) throw error;
    const wrappedError = new Error(
      error.response?.data?.message || error.message || 'Media upload failed'
    );
    wrappedError.userCode = error.response?.data?.error?.code;
    wrappedError.response = error.response;
    throw wrappedError;
  } finally {
    if (typeof body.close === 'function') body.close();
  }
};
