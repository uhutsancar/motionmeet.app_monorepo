import type { DistanceBand, DistanceVisibility } from "@motionmeet/shared";

/**
 * Turns a metre distance into the only thing a client is ever told about it.
 *
 * The floor is deliberate. Nothing below a kilometre is distinguishable, so two
 * members in the same building and two members a few streets apart produce the
 * same answer. That is what makes the endpoint useless for trilateration: an
 * attacker moving their own fix around and re-querying learns which kilometre
 * ring someone is in and nothing finer, no matter how many samples they take.
 *
 * The visibility argument is the *subject's* preference, never the searcher's.
 */
const BAND_THRESHOLDS: ReadonlyArray<{ maxMeters: number; band: DistanceBand }> = Object.freeze([
  { maxMeters: 1_000, band: "nearby" },
  { maxMeters: 2_000, band: "within_2km" },
  { maxMeters: 5_000, band: "2_5km" },
  { maxMeters: 10_000, band: "5_10km" },
  { maxMeters: 25_000, band: "10_25km" },
  { maxMeters: 50_000, band: "25_50km" },
]);

export const distanceBandFor = (
  meters: number,
  visibility: DistanceVisibility,
  sameCity: boolean,
): DistanceBand => {
  if (visibility === "hidden") return "unknown";
  if (!Number.isFinite(meters) || meters < 0) return "unknown";
  // "Show only that I am nearby" collapses every in-range distance into the
  // coarsest band rather than hiding the member, so they stay discoverable.
  if (visibility === "nearby_only") return "nearby";
  const match = BAND_THRESHOLDS.find((threshold) => meters <= threshold.maxMeters);
  if (match) return match.band;
  return sameCity ? "same_city" : "same_region";
};
