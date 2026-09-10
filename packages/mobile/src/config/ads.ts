/**
 * Central ad configuration.
 *
 * Every other module that touches ads reads its answers from here instead of
 * branching on env vars or __DEV__ itself, so "are ads on", "which unit id",
 * and "how often in the feed" each have exactly one place they're decided.
 */

/**
 * Master switch. `EXPO_PUBLIC_ADS_ENABLED=false` turns ads off everywhere
 * without touching code - useful for a QA build that must not fetch ads at
 * all. Ads are on by default once the SDK is wired in.
 */
export const ADS_ENABLED = process.env.EXPO_PUBLIC_ADS_ENABLED !== 'false';

/**
 * Whether real AdMob inventory may be requested.
 *
 * This is a hardcoded false, not an env var: no production ad units exist in
 * the AdMob dashboard yet (see docs/mobile-admob.md), so there is nothing a
 * real ad request could resolve to. Flip this only after production ad unit
 * ids are filled in below AND you've decided to go live - never derive it
 * from NODE_ENV/__DEV__, since a release APK sideloaded for QA is still a
 * "production" JS bundle that must keep serving test ads.
 */
export const ADS_PRODUCTION_ENABLED = false;

/**
 * Production ad unit ids, filled in once they exist in the AdMob dashboard.
 * Unused while ADS_PRODUCTION_ENABLED is false.
 */
const PRODUCTION_AD_UNITS = {
  androidBanner: '',
  androidNative: '',
  iosBanner: '',
  iosNative: '',
} as const;

/**
 * How many real posts separate one ad row from the next in Home/Explore.
 *
 * A fixed gap made every ad land in a fixed rhythm, which reads as denser
 * than it is once someone scrolls fast enough to see two in a row line up
 * the same way each session. Randomizing within the range breaks that
 * pattern without changing the average frequency.
 */
export const AD_FREQUENCY_POSTS_RANGE = { min: 10, max: 15 } as const;

/** Picks one gap size for the current feed render. */
export const nextAdFrequency = (): number => {
  const { min, max } = AD_FREQUENCY_POSTS_RANGE;
  return min + Math.floor(Math.random() * (max - min + 1));
};

export type AdUnitKind = 'banner' | 'native';

/**
 * Resolves an ad unit id for the current platform, always returning Google's
 * official test id unless production ads have been deliberately turned on
 * and a real id is configured for that slot.
 */
export const resolveAdUnitId = (
  kind: AdUnitKind,
  platformOS: 'ios' | 'android' | string,
  testIds: { BANNER: string; NATIVE: string },
): string => {
  if (ADS_PRODUCTION_ENABLED) {
    const key = platformOS === 'ios'
      ? (kind === 'banner' ? 'iosBanner' : 'iosNative')
      : (kind === 'banner' ? 'androidBanner' : 'androidNative');
    const configured = PRODUCTION_AD_UNITS[key];
    if (configured) return configured;
  }
  return kind === 'banner' ? testIds.BANNER : testIds.NATIVE;
};
