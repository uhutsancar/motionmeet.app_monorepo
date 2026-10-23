import { useAppSelector } from '../store/hooks';
import { ADS_ENABLED } from '../config/ads';

/**
 * Whether ads may be shown to the current user right now.
 *
 * MotionMeet has no paid tier, so there is nothing to be exempt from: every
 * signed-in member sees ads while the master switch is on. It still waits for
 * the profile to load, so a signed-out screen or a half-restored session never
 * requests inventory. Consent and SDK readiness are checked separately by
 * `useAdsReady`.
 */
export const useAdEntitlement = (): { shouldShowAds: boolean } => {
  const signedIn = useAppSelector((state) => Boolean(state.user.value));
  return { shouldShowAds: ADS_ENABLED && signedIn };
};
