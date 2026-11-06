import { sql } from "kysely";
import type {
  DistanceVisibility,
  NearbyScope,
  NearbySettings,
  NearbyUser,
} from "@motionmeet/shared";
import { DISTANCE_VISIBILITIES, NEARBY_SCOPES, NEARBY_SCOPE_METERS } from "@motionmeet/shared";
import { database } from "../configs/database.js";
import { cachedOwnerField, invalidateCacheOwners } from "../configs/redis.js";
import { distanceMeters, withinRadius } from "./locationGeometry.js";
import { describeCity, findNearestCity } from "./locationService.js";
import { getRelationshipMap } from "./relationshipService.js";
import { distanceBandFor } from "../utils/distanceBands.js";
import { profileImageUrl } from "./mediaDelivery.js";

/**
 * Nearby: proximity search over device GPS fixes.
 *
 * The single rule this module exists to enforce is that a coordinate goes in
 * and never comes back out. Fixes are written to `user_locations`, compared
 * inside PostgreSQL, and reported to clients only as a coarse distance band
 * plus a city-level area label. No endpoint here returns latitude, longitude,
 * accuracy or a metre count, and nothing here is logged.
 *
 * It shares no state with the profile location in locationService.ts: a member
 * can appear in nearby results with an empty profile location, or show
 * "Bursa" on their profile while standing in İstanbul, and neither changes the
 * other.
 */

/**
 * A fix older than this stops being evidence of where someone is, so it drops
 * out of everyone else's results. The row is kept: the member may open the app
 * tomorrow and refresh it.
 */
const FIX_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;
const RESULTS_CACHE_SECONDS = 45;
const MAX_RESULTS = 50;

export const parseScope = (value: unknown): NearbyScope | null =>
  NEARBY_SCOPES.includes(value as NearbyScope) ? (value as NearbyScope) : null;

export const parseDistanceVisibility = (value: unknown): DistanceVisibility | null =>
  DISTANCE_VISIBILITIES.includes(value as DistanceVisibility) ? (value as DistanceVisibility) : null;

export const parseCoordinate = (value: unknown, limit: number): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
};

interface SettingsRow {
  enabled: boolean;
  visible: boolean;
  distance_visibility: DistanceVisibility;
  scope: NearbyScope;
  city_id: number | null;
  location_updated_at: Date;
}

const DEFAULT_SETTINGS: NearbySettings = {
  enabled: false, visible: true, distanceVisibility: "approximate", scope: "25km",
  locationUpdatedAt: null, approximateArea: null, stale: true,
};

const isStale = (updatedAt: Date): boolean => Date.now() - new Date(updatedAt).getTime() > FIX_VALIDITY_MS;

const toSettings = async (row: SettingsRow | undefined): Promise<NearbySettings> => {
  if (!row) return DEFAULT_SETTINGS;
  return {
    enabled: row.enabled,
    visible: row.visible,
    distanceVisibility: row.distance_visibility,
    scope: row.scope,
    locationUpdatedAt: new Date(row.location_updated_at).toISOString(),
    approximateArea: await describeCity(row.city_id),
    stale: isStale(row.location_updated_at),
  };
};

const readSettingsRow = (userId: string) =>
  database
    .selectFrom("user_locations")
    .select(["enabled", "visible", "distance_visibility", "scope", "city_id", "location_updated_at"])
    .where("user_id", "=", userId)
    .executeTakeFirst();

export const getNearbySettings = async (userId: string): Promise<NearbySettings> =>
  toSettings(await readSettingsRow(userId) as SettingsRow | undefined);

/**
 * Stores a fix. The city is resolved here, once per write, so the listing query
 * never has to geocode and the "same city" scope is a plain integer compare.
 */
export const savePosition = async (
  userId: string,
  fix: { latitude: number; longitude: number; accuracy?: number | null; source?: "gps" | "network" | "coarse"; permissionStatus?: string },
): Promise<NearbySettings> => {
  const city = await findNearestCity(fix.latitude, fix.longitude);
  const now = new Date();
  const values = {
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy_meters: Number.isFinite(Number(fix.accuracy)) && Number(fix.accuracy) >= 0 ? Number(fix.accuracy) : null,
    source: fix.source ?? "gps",
    city_id: city?.id ?? null,
    permission_status: (fix.permissionStatus ?? "granted").slice(0, 24),
    location_updated_at: now,
  } as const;

  await database
    .insertInto("user_locations")
    // A first fix implies the member just went through the opt-in flow, so the
    // feature is switched on. Later fixes leave every preference untouched.
    .values({ user_id: userId, enabled: true, ...values })
    .onConflict((conflict) => conflict.column("user_id").doUpdateSet(values))
    .execute();

  await invalidateNearbyResults(userId);
  return getNearbySettings(userId);
};

export const updateNearbySettings = async (
  userId: string,
  patch: { enabled?: boolean; visible?: boolean; distanceVisibility?: DistanceVisibility; scope?: NearbyScope },
): Promise<NearbySettings> => {
  const changes = {
    ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
    ...(patch.visible === undefined ? {} : { visible: patch.visible }),
    ...(patch.distanceVisibility === undefined ? {} : { distance_visibility: patch.distanceVisibility }),
    ...(patch.scope === undefined ? {} : { scope: patch.scope }),
  };
  if (!Object.keys(changes).length) return getNearbySettings(userId);

  // Preferences can be set before the first fix arrives - the opt-in screen
  // writes `enabled` while the GPS is still being read - so the row is created
  // with a placeholder coordinate that is unusable until a real fix lands.
  const updated = await database.updateTable("user_locations").set(changes).where("user_id", "=", userId).executeTakeFirst();
  if (Number(updated.numUpdatedRows ?? 0) === 0) {
    await database
      .insertInto("user_locations")
      .values({ user_id: userId, latitude: 0, longitude: 0, city_id: null, location_updated_at: new Date(0), ...changes })
      .onConflict((conflict) => conflict.column("user_id").doUpdateSet(changes))
      .execute();
  }

  await invalidateNearbyResults(userId);
  return getNearbySettings(userId);
};

/**
 * Full erasure of the sensitive row, exposed to members as "delete my location
 * data". Preferences go with it, which is the point: nothing about where the
 * member has been survives.
 */
export const deletePosition = async (userId: string): Promise<void> => {
  await database.deleteFrom("user_locations").where("user_id", "=", userId).execute();
  await invalidateNearbyResults(userId);
};

const nearbyOwner = (userId: string): string => `nearby:${userId}`;
const invalidateNearbyResults = (userId: string): Promise<void> => invalidateCacheOwners(nearbyOwner(userId));

export interface NearbyListResult {
  users: NearbyUser[];
  settings: NearbySettings;
  /** Set when the list is empty for a reason the member can act on. */
  reason: "disabled" | "no_fix" | "stale_fix" | "no_results" | null;
}

/**
 * What the nearby cache holds: the expensive part of a search - which members
 * are inside the scope and how far away - and nothing that decides whether
 * they may be shown. Internal only: it never reaches a client and is never
 * logged. The distance is rounded to 100 m before it is stored, which is still
 * ten times finer than the coarsest band boundary it feeds.
 */
interface NearbyCandidate { id: string; distanceMeters: number }

interface PresentationRow {
  id: string;
  full_name: string;
  username: string;
  profile_picture_url: string;
  bio: string;
  location: string;
  location_visibility: string;
  distance_visibility: DistanceVisibility;
  city_id: number | null;
  city_name: string | null;
  region_name: string | null;
  location_updated_at: Date;
}

/**
 * A fix's timestamp as shown to other members: to the hour. Enough for "active
 * in the last hour / today", and it no longer tells a stranger the exact
 * second somebody's phone last reported a position.
 */
const toHour = (value: Date): string => {
  const hour = new Date(value);
  hour.setUTCMinutes(0, 0, 0);
  return hour.toISOString();
};

/**
 * Members within the requested scope, ordered by real distance but reported in
 * bands.
 *
 * Privacy is applied on every request, after the cache. The cache used to hold
 * the finished cards, so a member who switched visibility off, deleted their
 * location, left search, deleted their account or switched their distance to
 * "hidden" stayed in everyone else's cached results - band and area label
 * included - for up to 45 seconds (R3/R7 in the 2026-11 audit). Now it only
 * holds the candidate ids and distances; every request re-reads those members'
 * current switches, labels and follow state in one primary-key lookup, and
 * anyone who no longer qualifies simply drops out.
 *
 * A target's *position* can still be up to 45 seconds old in somebody's
 * results. That only moves them between bands; it never shows anyone who has
 * opted out.
 */
export const listNearbyUsers = async (userId: string, requestedLimit = 20): Promise<NearbyListResult> => {
  const settings = await getNearbySettings(userId);
  if (!settings.enabled) return { users: [], settings, reason: "disabled" };

  const own = await database
    .selectFrom("user_locations")
    .select(["latitude", "longitude", "city_id", "scope", "location_updated_at"])
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!own || settings.locationUpdatedAt === null) return { users: [], settings, reason: "no_fix" };
  if (isStale(own.location_updated_at)) return { users: [], settings, reason: "stale_fix" };

  const limit = Math.min(Math.max(requestedLimit, 1), MAX_RESULTS);
  const field = `${own.scope}:${limit}:${new Date(own.location_updated_at).getTime()}`;
  const candidates = await cachedOwnerField(nearbyOwner(userId), field, RESULTS_CACHE_SECONDS, () => queryNearbyCandidates(userId, own, limit));
  const users = await presentCandidates(userId, own.city_id, candidates);
  return { users, settings, reason: users.length ? null : "no_results" };
};

/**
 * The distance search. The searcher's own row, opted-out rows and stale fixes
 * are excluded in SQL here too, so a fresh result never even lists them.
 */
const queryNearbyCandidates = async (
  userId: string,
  own: { latitude: number; longitude: number; city_id: number | null; scope: NearbyScope },
  limit: number,
): Promise<NearbyCandidate[]> => {
  const freshAfter = new Date(Date.now() - FIX_VALIDITY_MS);
  const distance = distanceMeters("ul", own.latitude, own.longitude);

  let query = database
    .selectFrom("user_locations as ul")
    .innerJoin("users as u", "u.id", "ul.user_id")
    .select(["u.id", distance.as("distance_meters")])
    .where("ul.enabled", "=", true)
    .where("ul.visible", "=", true)
    .where("ul.user_id", "!=", userId)
    .where("ul.location_updated_at", ">", freshAfter)
    // The same switch that keeps a member out of people search keeps them out
    // of nearby; there is no second opt-out to forget about.
    .where("u.privacy_show_in_search", "=", true);

  if (own.scope !== "city") {
    query = query.where(withinRadius("ul", own.latitude, own.longitude, NEARBY_SCOPE_METERS[own.scope]));
  } else if (own.city_id !== null) {
    query = query.where("ul.city_id", "=", own.city_id);
  } else {
    // The fix landed somewhere the dataset has no settlement for, so "same city"
    // cannot be evaluated. Widening to the largest radius beats an empty screen
    // the member has no way to explain.
    query = query.where(withinRadius("ul", own.latitude, own.longitude, NEARBY_SCOPE_METERS["50km"]));
  }

  const rows = await query.orderBy(sql`distance_meters`, "asc").orderBy("u.id", "asc").limit(limit).execute() as unknown as Array<{ id: string; distance_meters: number }>;
  return rows.map((row) => ({ id: row.id, distanceMeters: Math.round(Number(row.distance_meters) / 100) * 100 }));
};

/**
 * Turns cached candidates into cards using each member's *current* state. The
 * `where` clause is the same opt-out set as the search itself; a candidate the
 * lookup no longer returns is dropped, not shown with stale data.
 */
const presentCandidates = async (viewerId: string, ownCityId: number | null, candidates: NearbyCandidate[]): Promise<NearbyUser[]> => {
  if (!candidates.length) return [];
  const freshAfter = new Date(Date.now() - FIX_VALIDITY_MS);
  const [rows, relationships] = await Promise.all([
    database
      .selectFrom("user_locations as ul")
      .innerJoin("users as u", "u.id", "ul.user_id")
      .leftJoin("location_cities as c", "c.id", "ul.city_id")
      .leftJoin("location_states as s", "s.id", "c.state_id")
      .select([
        "u.id", "u.full_name", "u.username", "u.profile_picture_url", "u.bio", "u.location", "u.location_visibility",
        "ul.distance_visibility", "ul.city_id", "ul.location_updated_at",
        "c.name as city_name", "s.name as region_name",
      ])
      .where("ul.user_id", "in", candidates.map((candidate) => candidate.id))
      .where("ul.enabled", "=", true)
      .where("ul.visible", "=", true)
      .where("ul.location_updated_at", ">", freshAfter)
      .where("u.privacy_show_in_search", "=", true)
      .execute() as Promise<PresentationRow[]>,
    // One extra query for the whole page, so each card can open on the right
    // follow state instead of offering "Takip et" for someone already followed.
    getRelationshipMap(viewerId, candidates.map((candidate) => candidate.id)),
  ]);
  const current = new Map(rows.map((row) => [row.id, row]));

  return candidates.flatMap((candidate): NearbyUser[] => {
    const row = current.get(candidate.id);
    if (!row) return [];
    return [{
      id: row.id,
      _id: row.id,
      full_name: row.full_name,
      username: row.username,
      profile_picture: profileImageUrl(row.profile_picture_url),
      bio: row.bio,
      // A member who restricted their profile location keeps it hidden here too.
      location: row.location_visibility === "public" ? row.location : "",
      distanceBand: distanceBandFor(candidate.distanceMeters, row.distance_visibility, row.city_id !== null && row.city_id === ownCityId),
      approximateArea: row.distance_visibility === "hidden"
        ? null
        : [row.city_name, row.region_name !== row.city_name ? row.region_name : null].filter(Boolean).join(", ") || null,
      lastActiveAt: toHour(row.location_updated_at),
      ...(relationships.get(row.id) ?? { isFollowing: false, isFollowedBy: false, requestSent: false, requestReceived: false }),
    }];
  });
};
