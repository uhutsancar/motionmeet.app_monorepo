import Constants from 'expo-constants';
import { TurboModuleRegistry } from 'react-native';

/**
 * react-native-google-mobile-ads ships native code with no Expo Go fallback:
 * its entry calls `TurboModuleRegistry.getEnforcing('RNGoogleMobileAdsModule')`
 * at load time, which throws wherever that module isn't linked (Expo Go, or
 * a dev build made before ads were added). `appOwnership === 'expo'` is the
 * one Constants field that identifies Expo Go specifically - unlike
 * `executionEnvironment`, which reports the same value for Expo Go and for
 * our own dev-client build - but it's deprecated and Android Expo Go doesn't
 * reliably set it, so it's only a fast path; getAdsModule's native-module
 * probe is the real gate.
 */
export const isExpoGo = Constants.appOwnership === 'expo';

type AdsModule = typeof import('react-native-google-mobile-ads');

let cached: AdsModule | null | undefined;

/**
 * Lazily requires the ads SDK, or returns null when it can't be used
 * (Expo Go, or the native module genuinely isn't linked for some other
 * reason). Never throws - every ad surface in the app treats "no module" the
 * same as "no ad to show".
 *
 * The probe has to happen before the require: in dev, Metro's require guard
 * hands a module-init error to ErrorUtils instead of rethrowing it, so the
 * try/catch below never sees a missing native module and the app gets the
 * "RNGoogleMobileAdsModule could not be found" error screen anyway.
 */
export const getAdsModule = (): AdsModule | null => {
  if (isExpoGo) return null;
  if (cached !== undefined) return cached;
  if (!TurboModuleRegistry.get('RNGoogleMobileAdsModule')) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-google-mobile-ads') as AdsModule;
  } catch (error) {
    console.warn('[ads] react-native-google-mobile-ads native module unavailable:', error);
    cached = null;
  }
  return cached;
};
