import { Platform } from 'react-native';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim();
const developmentFallback = Platform.OS === 'android'
  ? 'http://10.0.2.2:4000'
  : 'http://localhost:4000';

const normalizeBackendUrl = (url: string): string => url
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '[::1]' ||
  hostname === '::1';

const alignWebLoopbackHost = (value: string): string => {
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
export const WEB_URL = (configuredWebUrl || 'http://localhost:5173').replace(/\/+$/, '');

if (!configuredApiUrl) {
  const message =
    `[Config] EXPO_PUBLIC_API_URL is not set; using ${developmentFallback}. ` +
    'Set it to a LAN-accessible backend URL when running on a physical device.';

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(message);
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

/**
 * Escape hatch for sideloaded QA builds that have to reach a backend on the
 * developer's own machine.
 *
 * Embedding a *development* bundle used to serve this purpose, but React Native
 * now aborts module evaluation in that configuration - it tries to open a
 * devtools websocket, throws "Cannot create devtools websocket connections in
 * embedded environments", and `AppRegistry.registerComponent` never runs, so the
 * app opens to a white screen. A normal production bundle is the only one that
 * boots, hence this flag.
 *
 * It is deliberately narrow: the opt-in must be explicit *and* the host has to
 * be loopback or a private LAN address. A build pointed at a public http origin
 * still fails, so this cannot be used to ship cleartext traffic to real users.
 */
const allowInsecureLanOrigin = process.env.EXPO_PUBLIC_ALLOW_INSECURE_LAN?.trim() === 'true';

// Same ranges the backend treats as a trusted development origin; see
// configs/environment.ts there.
const isPrivateHost = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    if (isLoopbackHost(hostname)) return true;
    if (/^10(?:\.\d{1,3}){3}$/.test(hostname)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(hostname)) return true;
    const match = hostname.match(/^172\.(\d{1,3})(?:\.\d{1,3}){2}$/);
    return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
  } catch {
    return false;
  }
};

const isProductionBundle = typeof __DEV__ === 'undefined' || !__DEV__;
const originsAreSecure = /^https:\/\//i.test(API_URL) && /^https:\/\//i.test(WEB_URL);

if (isProductionBundle && !originsAreSecure) {
  if (!allowInsecureLanOrigin) {
    throw new Error('[Config] Production mobile builds require HTTPS API and web origins.');
  }
  if (!isPrivateHost(API_URL) || !isPrivateHost(WEB_URL)) {
    throw new Error(
      '[Config] EXPO_PUBLIC_ALLOW_INSECURE_LAN only covers loopback and private LAN hosts. ' +
      'Use HTTPS origins for any build that leaves the local network.'
    );
  }
  console.warn(
    '[Config] Insecure LAN origins are enabled. This build is for local device testing only and must never be published.'
  );
}
