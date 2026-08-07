import type { EntityId } from "./common.js";

/**
 * MotionMeet keeps two location concepts apart on purpose.
 *
 * - The *profile location* is a place the athlete picked from the reference
 *   dataset. It is coarse (city / region / country), visible to other people and
 *   never changes on its own.
 * - The *nearby location* is the device GPS fix. It never leaves the backend:
 *   it only feeds proximity queries and is reported back as a coarse distance
 *   band, never as coordinates.
 *
 * The two are stored in different tables and exposed through different
 * endpoints so that turning one off can never leak the other.
 */

/** Which administrative layer a suggestion came from. */
export type LocationKind = "city" | "state" | "country";

/** How a profile location ended up on the account. */
export type ProfileLocationSource =
  | "manual_search"
  | "current_location"
  | "onboarding"
  | "profile_update";

/** Who may see the profile location on a profile. */
export type ProfileLocationVisibility = "public" | "followers" | "connections" | "private";

/** How much distance detail a member is willing to expose in nearby results. */
export type DistanceVisibility = "approximate" | "nearby_only" | "hidden";

/** Radius options offered in the nearby screen. `city` means "same city only". */
export type NearbyScope = "5km" | "10km" | "25km" | "50km" | "city";

/**
 * Coarse distance buckets. Anything closer than a kilometre collapses into
 * `nearby` so that repeated queries cannot be used to triangulate a member.
 */
export type DistanceBand =
  | "nearby"
  | "within_2km"
  | "2_5km"
  | "5_10km"
  | "10_25km"
  | "25_50km"
  | "same_city"
  | "same_region"
  | "unknown";

export const NEARBY_SCOPES: readonly NearbyScope[] = Object.freeze(["5km", "10km", "25km", "50km", "city"]);
export const DISTANCE_VISIBILITIES: readonly DistanceVisibility[] = Object.freeze(["approximate", "nearby_only", "hidden"]);
export const PROFILE_LOCATION_VISIBILITIES: readonly ProfileLocationVisibility[] = Object.freeze(["public", "followers", "connections", "private"]);

/** Metres covered by each radius option; `city` is handled by city id equality. */
export const NEARBY_SCOPE_METERS: Readonly<Record<Exclude<NearbyScope, "city">, number>> = Object.freeze({
  "5km": 5_000,
  "10km": 10_000,
  "25km": 25_000,
  "50km": 50_000,
});

/** A single row in the location autocomplete list. */
export interface LocationSuggestion {
  /** Stable dataset identifier, unique per `kind`. */
  id: number;
  kind: LocationKind;
  /** Primary label, e.g. `Nilüfer`. */
  name: string;
  /** Full label built by the backend, e.g. `Nilüfer, Bursa, Türkiye`. */
  displayName: string;
  /** Region label when the record has one, e.g. `Bursa`. */
  regionName: string | null;
  countryName: string;
  countryCode: string;
  countryEmoji: string;
}

/** The profile location attached to an account. */
export interface ProfileLocation {
  countryId: number | null;
  stateId: number | null;
  cityId: number | null;
  /** Backend-generated text; clients must never send their own. */
  displayName: string;
  countryCode: string;
  source: ProfileLocationSource | null;
  visibility: ProfileLocationVisibility;
  selectedAt: string | null;
}

/** Payload accepted when saving a profile location. Exactly one id is used. */
export interface ProfileLocationInput {
  cityId?: number | null;
  stateId?: number | null;
  countryId?: number | null;
  source?: ProfileLocationSource;
  visibility?: ProfileLocationVisibility;
}

/** The member's own nearby settings, returned by the settings endpoint. */
export interface NearbySettings {
  enabled: boolean;
  /** When false the member searches but is not listed for others. */
  visible: boolean;
  distanceVisibility: DistanceVisibility;
  scope: NearbyScope;
  /** ISO timestamp of the last accepted GPS fix, never the fix itself. */
  locationUpdatedAt: string | null;
  /** Coarse label for "where you are right now", e.g. `Nilüfer, Bursa`. */
  approximateArea: string | null;
  /** True when the stored fix is too old to be used in queries. */
  stale: boolean;
}

/** One member in the nearby list. Coordinates are never included. */
export interface NearbyUser {
  id: EntityId;
  _id: EntityId;
  full_name: string;
  username: string;
  profile_picture: string;
  bio: string;
  /** Profile location text when the member shares one, otherwise empty. */
  location: string;
  distanceBand: DistanceBand;
  /** Coarse label of the other member's area, subject to their settings. */
  approximateArea: string | null;
  lastActiveAt: string | null;
}

/** Result of resolving a raw GPS fix to a dataset record. */
export interface LocationSuggestionFromCoordinates {
  suggestion: LocationSuggestion | null;
  /** Coarse label to show while asking "set your profile location to this?". */
  approximateArea: string | null;
}

/** Attribution that must stay visible in shipped builds; see docs/LICENSES.md. */
export const LOCATION_DATASET_ATTRIBUTION = Object.freeze({
  name: "Countries States Cities Database",
  url: "https://github.com/dr5hn/countries-states-cities-database",
  license: "ODbL v1.0",
  licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  text: "Data by Countries States Cities Database — https://github.com/dr5hn/countries-states-cities-database | ODbL v1.0",
});
