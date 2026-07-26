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

export const uploadMedia = async (asset, purpose, token) => {
  if (!asset?.uri) throw new Error('A valid media file is required');
  const localResponse = await fetch(asset.uri);
  if (!localResponse.ok) throw new Error('Selected media could not be read');
  const body = await localResponse.blob();
  try {
    const contentType =
      asset.mimeType ||
      (asset.type?.includes('/') ? asset.type : null) ||
      body.type ||
      extensionType(asset.uri);
    const fileName =
      asset.fileName ||
      asset.name ||
      `${purpose}-${Date.now()}.${contentType.split('/')[1] || 'bin'}`;
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
    throw new Error(
      error.response?.data?.message ||
      error.message ||
      'Media upload failed',
    );
  } finally {
    if (typeof body.close === 'function') body.close();
  }
};
