import Constants from 'expo-constants';

/**
 * react-native-google-mobile-ads ships native code with no Expo Go fallback:
 * requiring it inside Expo Go throws ("RNGoogleMobileAdsModule could not be
 * found") the moment the native binding is touched. `appOwnership === 'expo'`
 * is the one Constants field that identifies Expo Go specifically - unlike
 * `executionEnvironment`, which reports the same value for Expo Go and for
 * our own dev-client build - so it's the gate used everywhere ads are loaded.
 */
export const isExpoGo = Constants.appOwnership === 'expo';

type AdsModule = typeof import('react-native-google-mobile-ads');

let cached: AdsModule | null | undefined;

/**
 * Lazily requires the ads SDK, or returns null when it can't be used
 * (Expo Go, or the native module genuinely isn't linked for some other
 * reason). Never throws - every ad surface in the app treats "no module" the
 * same as "no ad to show".
 */
export const getAdsModule = (): AdsModule | null => {
  if (isExpoGo) return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-google-mobile-ads') as AdsModule;
  } catch (error) {
    console.warn('[ads] react-native-google-mobile-ads native module unavailable:', error);
    cached = null;
  }
  return cached;
};
