import { useAppSelector } from '../store/hooks';
import { ADS_ENABLED } from '../config/ads';

/**
 * Whether ads may be shown to the current user right now.
 *
 * Fails closed: until the profile has loaded *and* resolved a populated
 * plan, this reports `false` rather than guessing. `getUserById` on the
 * backend requests the plan populated (`{ plan: true }`), so a logged-in
 * user's `plan` is normally a full `Plan` object with `.features.ad_free` -
 * but if that ever regresses to an id-only reference, ads simply stay off
 * instead of showing to someone who paid to not see them.
 */
export const useAdEntitlement = (): { shouldShowAds: boolean } => {
  const { value: user, loading } = useAppSelector((state) => state.user);

  if (!ADS_ENABLED) return { shouldShowAds: false };
  if (loading || !user) return { shouldShowAds: false };

  const plan = user.plan;
  const isPopulatedPlan = typeof plan === 'object' && plan !== null && 'features' in plan;
  if (!isPopulatedPlan) return { shouldShowAds: false };

  return { shouldShowAds: plan.features.ad_free !== true };
};
