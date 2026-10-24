/**
 * Web build of adsModule.ts.
 *
 * react-native-google-mobile-ads has no web implementation, and its specs
 * import native-only React Native internals, so even the lazy `require` in the
 * native file made `expo export --platform web` fail to bundle. Metro picks
 * this file for web instead; every ad surface already treats a null module as
 * "no ad to show". Android and iOS keep using adsModule.ts unchanged.
 */
type AdsModule = typeof import('react-native-google-mobile-ads');

export const isExpoGo = false;

export const getAdsModule = (): AdsModule | null => null;
