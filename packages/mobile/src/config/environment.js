import { Platform } from 'react-native';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const developmentFallback = Platform.OS === 'android'
  ? 'http://10.0.2.2:4000'
  : 'http://localhost:4000';

const normalizeBackendUrl = (url) => url
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

const isLoopbackHost = (hostname) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '[::1]' ||
  hostname === '::1';

const alignWebLoopbackHost = (value) => {
  const normalized = normalizeBackendUrl(value);
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    !isLoopbackHost(window.location.hostname)
  ) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    if (isLoopbackHost(url.hostname)) {
      url.hostname = window.location.hostname;
      return normalizeBackendUrl(url.toString());
    }
  } catch {
    // Relative same-origin URLs do not need host alignment.
  }

  return normalized;
};

export const API_URL = alignWebLoopbackHost(configuredApiUrl || developmentFallback);
export const SOCKET_URL = API_URL;

if (!configuredApiUrl) {
  const message =
    `[Config] EXPO_PUBLIC_API_URL is not set; using ${developmentFallback}. ` +
    'Set it to a LAN-accessible backend URL when running on a physical device.';

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(message);
  } else {
    throw new Error(
      '[Config] EXPO_PUBLIC_API_URL is required for production builds. ' +
      'Set it to the public backend origin before starting the app.'
    );
  }
}

if (!/^https?:\/\//i.test(API_URL)) {
  throw new Error('[Config] EXPO_PUBLIC_API_URL must start with http:// or https://.');
}

if (
  (typeof __DEV__ === 'undefined' || !__DEV__) &&
  !/^https:\/\//i.test(API_URL)
) {
  throw new Error('[Config] Production mobile builds require an HTTPS API origin.');
}
