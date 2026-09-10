import { ADS_ENABLED } from '../config/ads';
import { getAdsModule } from './adsModule';

let initPromise: Promise<boolean> | null = null;

/**
 * Requests UMP consent, then starts the Mobile Ads SDK. Safe to call more
 * than once - later calls reuse the first attempt instead of re-running it.
 *
 * Resolves to whether ad requests are allowed right now; never rejects.
 * Nothing that depends on ads (the banner, the feed's ad row) should ever
 * fail to render just because consent or SDK init had a bad day - they treat
 * `false` the same as "no ad for this user right now".
 */
export const ensureAdsInitialized = (): Promise<boolean> => {
  if (!ADS_ENABLED) return Promise.resolve(false);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const ads = getAdsModule();
    if (!ads) return false;

    try {
      // Requests consent info and shows the UMP form only where required
      // (e.g. EEA); a no-op everywhere else.
      await ads.AdsConsent.gatherConsent();
    } catch (error) {
      console.warn('[ads] consent gathering failed, continuing without it:', error);
    }

    try {
      const { canRequestAds } = await ads.AdsConsent.getConsentInfo();
      if (!canRequestAds) return false;
    } catch (error) {
      console.warn('[ads] could not read consent info, assuming ads are not allowed yet:', error);
      return false;
    }

    try {
      await ads.default().initialize();
      return true;
    } catch (error) {
      console.warn('[ads] Mobile Ads SDK failed to initialize:', error);
      return false;
    }
  })();

  return initPromise;
};
