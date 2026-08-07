import type { DistanceBand, NearbyScope } from '@motionmeet/shared';

/**
 * Copy for the coarse distance bands and radius options.
 *
 * The nearby screen and the feed carousel both render these, and a member who
 * sees "2-5 km" in one place must not see "2 to 5 km" in the other, so the
 * strings live in one module instead of being retyped per screen.
 */
interface LabelEntry { key: string; fallback: string }

export const BAND_LABELS: Record<DistanceBand, LabelEntry> = {
  nearby: { key: 'nearby.band_nearby', fallback: 'Nearby' },
  within_2km: { key: 'nearby.band_within_2km', fallback: 'Within 2 km' },
  '2_5km': { key: 'nearby.band_2_5km', fallback: '2–5 km' },
  '5_10km': { key: 'nearby.band_5_10km', fallback: '5–10 km' },
  '10_25km': { key: 'nearby.band_10_25km', fallback: '10–25 km' },
  '25_50km': { key: 'nearby.band_25_50km', fallback: '25–50 km' },
  same_city: { key: 'nearby.band_same_city', fallback: 'Same city' },
  same_region: { key: 'nearby.band_same_region', fallback: 'Same area' },
  unknown: { key: 'nearby.band_unknown', fallback: 'Distance hidden' },
};

export const SCOPE_LABELS: Record<NearbyScope, LabelEntry> = {
  '5km': { key: 'nearby.scope_5km', fallback: '5 km' },
  '10km': { key: 'nearby.scope_10km', fallback: '10 km' },
  '25km': { key: 'nearby.scope_25km', fallback: '25 km' },
  '50km': { key: 'nearby.scope_50km', fallback: '50 km' },
  city: { key: 'nearby.scope_city', fallback: 'Same city' },
};
