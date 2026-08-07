import { sql } from "kysely";
import type {
  LocationKind,
  LocationSuggestion,
  ProfileLocation,
  ProfileLocationSource,
  ProfileLocationVisibility,
} from "@motionmeet/shared";
import { PROFILE_LOCATION_VISIBILITIES } from "@motionmeet/shared";
import { database } from "../configs/database.js";
import { getCachedJson, invalidateCachePrefix, setCachedJson } from "../configs/redis.js";
import { distanceMeters, withinRadius } from "./locationGeometry.js";
import { escapeLikePattern, formatAreaLabel, formatLocationLabel, normalizeLocationQuery } from "../utils/locationText.js";

/**
 * Profile location: the coarse, member-chosen place shown on a profile.
 *
 * Everything a client can pick comes from the imported Countries States Cities
 * tables, and the label a profile displays is built here rather than accepted
 * from the request. That combination is what makes the field safe: there is no
 * free-text path into someone's profile card, and no way to reference a record
 * the dataset does not contain.
 *
 * The GPS side of the product lives in nearbyService.ts and shares nothing with
 * this file except the reference tables.
 */

/** `users.location` is varchar(100); labels are built to fit rather than fail. */
const MAX_LABEL_LENGTH = 100;
const SEARCH_CACHE_SECONDS = 600;
const REFERENCE_CACHE_SECONDS = 3_600;
const RECENT_CACHE_SECONDS = 90 * 24 * 60 * 60;
const MAX_RECENT_ENTRIES = 8;
/** Suggestions fetched per layer before merging; the caller's limit trims after. */
const LAYER_LIMITS = { countries: 6, states: 10, cities: 25 } as const;
/** A fix further than this from any settlement gets no suggestion at all. */
const REVERSE_LOOKUP_RADIUS_METERS = 120_000;

export const MAX_SEARCH_RESULTS = 25;

type Locale = "tr" | "en";

export const parseLocale = (value: unknown): Locale => (typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en");

/** Two-letter ISO country code, or null. Used only to bias result ordering. */
export const parseCountryCode = (value: unknown): string | null =>
  typeof value === "string" && /^[A-Za-z]{2}$/.test(value.trim()) ? value.trim().toUpperCase() : null;

export const parseLocationKind = (value: unknown): LocationKind | null =>
  value === "city" || value === "state" || value === "country" ? value : null;

export const parseLocationId = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : null;
};

export const parseVisibility = (value: unknown): ProfileLocationVisibility | null =>
  PROFILE_LOCATION_VISIBILITIES.includes(value as ProfileLocationVisibility) ? (value as ProfileLocationVisibility) : null;

const PROFILE_LOCATION_SOURCES: readonly ProfileLocationSource[] = ["manual_search", "current_location", "onboarding", "profile_update"];
export const parseSource = (value: unknown): ProfileLocationSource =>
  PROFILE_LOCATION_SOURCES.includes(value as ProfileLocationSource) ? (value as ProfileLocationSource) : "manual_search";

interface SuggestionRow {
  id: number;
  kind: LocationKind;
  name: string;
  region_name: string | null;
  country_name: string;
  country_name_tr: string;
  country_code: string;
  country_emoji: string;
  population: number;
  search_name: string;
}

const countryLabel = (row: Pick<SuggestionRow, "country_name" | "country_name_tr">, locale: Locale): string =>
  (locale === "tr" && row.country_name_tr) || row.country_name;

/**
 * "Bursa, Bursa, Türkiye" reads as a data glitch, so a city that carries its
 * province's name drops the middle segment.
 */
const toSuggestion = (row: SuggestionRow, locale: Locale): LocationSuggestion => {
  const country = countryLabel(row, locale);
  const region = row.region_name && row.region_name !== row.name ? row.region_name : null;
  const displayName = row.kind === "country"
    ? country
    : row.kind === "state"
      ? formatLocationLabel({ region: row.name, country })
      : formatLocationLabel({ city: row.name, region, country });
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    displayName,
    regionName: region,
    countryName: country,
    countryCode: row.country_code,
    countryEmoji: row.country_emoji,
  };
};

/**
 * Tags each layer's rows with the kind they came from so the three queries can
 * be merged and ranked as one list. `sql.lit` emits the bare literal; adding an
 * alias here would collide with the `.as("kind")` Kysely appends.
 */
const kindColumn = (kind: LocationKind) => sql.lit<LocationKind>(kind);

const searchCities = (pattern: { exact: string; prefix: string; contains: string }, countryCode: string | null) =>
  database
    .selectFrom("location_cities as c")
    .innerJoin("location_countries as co", (join) => join.onRef("co.id", "=", "c.country_id").on("co.is_active", "=", true))
    .leftJoin("location_states as s", (join) => join.onRef("s.id", "=", "c.state_id").on("s.is_active", "=", true))
    .select([
      "c.id", "c.name", "c.search_name", "c.population",
      "s.name as region_name",
      "co.name as country_name", "co.name_tr as country_name_tr", "co.iso2 as country_code", "co.emoji as country_emoji",
      kindColumn("city").as("kind"),
    ])
    .where("c.is_active", "=", true)
    .where((eb) => eb.or([
      eb("c.search_name", "=", pattern.exact),
      eb("c.search_name", "like", pattern.prefix),
      eb("c.search_name", "like", pattern.contains),
    ]))
    .orderBy(sql`case when c.search_name = ${pattern.exact} then 0 when c.search_name like ${pattern.prefix} then 1 else 2 end`)
    .orderBy(sql`case when co.iso2 = ${countryCode ?? ""} then 0 else 1 end`)
    .orderBy("c.population", "desc")
    .orderBy("c.name", "asc")
    .limit(LAYER_LIMITS.cities)
    .execute();

const searchStates = (pattern: { exact: string; prefix: string; contains: string }, countryCode: string | null) =>
  database
    .selectFrom("location_states as s")
    .innerJoin("location_countries as co", (join) => join.onRef("co.id", "=", "s.country_id").on("co.is_active", "=", true))
    .select([
      "s.id", "s.name", "s.search_name",
      sql<number>`0`.as("population"),
      sql<string | null>`null`.as("region_name"),
      "co.name as country_name", "co.name_tr as country_name_tr", "co.iso2 as country_code", "co.emoji as country_emoji",
      kindColumn("state").as("kind"),
    ])
    .where("s.is_active", "=", true)
    .where((eb) => eb.or([
      eb("s.search_name", "=", pattern.exact),
      eb("s.search_name", "like", pattern.prefix),
      eb("s.search_name", "like", pattern.contains),
    ]))
    .orderBy(sql`case when s.search_name = ${pattern.exact} then 0 when s.search_name like ${pattern.prefix} then 1 else 2 end`)
    .orderBy(sql`case when co.iso2 = ${countryCode ?? ""} then 0 else 1 end`)
    .orderBy("s.name", "asc")
    .limit(LAYER_LIMITS.states)
    .execute();

const searchCountries = (pattern: { exact: string; prefix: string; contains: string }) =>
  database
    .selectFrom("location_countries as co")
    .select([
      "co.id", "co.name", "co.search_name",
      sql<number>`0`.as("population"),
      sql<string | null>`null`.as("region_name"),
      "co.name as country_name", "co.name_tr as country_name_tr", "co.iso2 as country_code", "co.emoji as country_emoji",
      kindColumn("country").as("kind"),
    ])
    .where("co.is_active", "=", true)
    .where((eb) => eb.or([
      eb("co.search_name", "=", pattern.exact),
      eb("co.search_name", "like", pattern.prefix),
      eb("co.search_name", "like", pattern.contains),
    ]))
    .orderBy(sql`case when co.search_name = ${pattern.exact} then 0 when co.search_name like ${pattern.prefix} then 1 else 2 end`)
    .orderBy("co.name", "asc")
    .limit(LAYER_LIMITS.countries)
    .execute();

/** Exact beats prefix beats contains; the member's own country breaks ties. */
const matchRank = (searchName: string, query: string): number => {
  if (searchName === query) return 0;
  if (searchName.startsWith(query)) return 1;
  return 2;
};

/** A city is what people mean most of the time, so it outranks its parents. */
const KIND_RANK: Record<LocationKind, number> = { city: 0, state: 1, country: 2 };

export const searchLocations = async (
  rawQuery: unknown,
  options: { countryCode?: string | null; locale?: Locale; limit?: number } = {},
): Promise<LocationSuggestion[]> => {
  const query = normalizeLocationQuery(rawQuery);
  if (!query) return [];

  const locale = options.locale ?? "en";
  const countryCode = options.countryCode ?? null;
  const limit = Math.min(Math.max(options.limit ?? 12, 1), MAX_SEARCH_RESULTS);
  const cacheKey = `loc:search:${locale}:${countryCode ?? "-"}:${limit}:${query}`;
  const cached = await getCachedJson<LocationSuggestion[]>(cacheKey);
  if (cached) return cached;

  const escaped = escapeLikePattern(query);
  const pattern = { exact: query, prefix: `${escaped}%`, contains: `%${escaped}%` };
  const [cities, states, countries] = await Promise.all([
    searchCities(pattern, countryCode),
    searchStates(pattern, countryCode),
    searchCountries(pattern),
  ]);

  const ranked = [...cities, ...states, ...countries]
    .map((row) => row as unknown as SuggestionRow)
    .sort((left, right) =>
      matchRank(left.search_name, query) - matchRank(right.search_name, query)
      || Number(right.country_code === countryCode) - Number(left.country_code === countryCode)
      || KIND_RANK[left.kind] - KIND_RANK[right.kind]
      || Number(right.population) - Number(left.population)
      || left.name.localeCompare(right.name));

  // A city that shares its province's name renders identically to the province
  // itself. Keeping only the better-ranked one avoids a list of twins.
  const seen = new Set<string>();
  const suggestions: LocationSuggestion[] = [];
  for (const row of ranked) {
    const suggestion = toSuggestion(row, locale);
    const key = suggestion.displayName.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
    if (suggestions.length >= limit) break;
  }

  await setCachedJson(cacheKey, suggestions, SEARCH_CACHE_SECONDS);
  return suggestions;
};

/** Full country list for the "browse instead of type" entry point. */
export const listCountries = async (locale: Locale): Promise<LocationSuggestion[]> => {
  const cacheKey = `loc:countries:${locale}`;
  const cached = await getCachedJson<LocationSuggestion[]>(cacheKey);
  if (cached) return cached;

  const rows = await database
    .selectFrom("location_countries as co")
    .select([
      "co.id", "co.name", "co.search_name",
      sql<number>`0`.as("population"),
      sql<string | null>`null`.as("region_name"),
      "co.name as country_name", "co.name_tr as country_name_tr", "co.iso2 as country_code", "co.emoji as country_emoji",
      kindColumn("country").as("kind"),
    ])
    .where("co.is_active", "=", true)
    .execute();

  const countries = rows
    .map((row) => toSuggestion(row as unknown as SuggestionRow, locale))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, locale));
  await setCachedJson(cacheKey, countries, REFERENCE_CACHE_SECONDS);
  return countries;
};

/**
 * Re-reads a suggestion from the database by id. Every write path goes through
 * this, so a client that posts an id it never saw - or one that has since been
 * deactivated - is rejected on the server rather than trusted.
 */
export const findSuggestion = async (kind: LocationKind, id: number, locale: Locale): Promise<LocationSuggestion | null> => {
  const cacheKey = `loc:node:${kind}:${id}:${locale}`;
  const cached = await getCachedJson<LocationSuggestion | null>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const row = await (kind === "city"
    ? database
      .selectFrom("location_cities as c")
      .innerJoin("location_countries as co", (join) => join.onRef("co.id", "=", "c.country_id").on("co.is_active", "=", true))
      .leftJoin("location_states as s", (join) => join.onRef("s.id", "=", "c.state_id").on("s.is_active", "=", true))
      .select(["c.id", "c.name", "c.search_name", "c.population", "s.name as region_name", "co.name as country_name", "co.name_tr as country_name_tr", "co.iso2 as country_code", "co.emoji as country_emoji", kindColumn("city").as("kind")])
      .where("c.is_active", "=", true).where("c.id", "=", id).executeTakeFirst()
    : kind === "state"
      ? database
        .selectFrom("location_states as s")
        .innerJoin("location_countries as co", (join) => join.onRef("co.id", "=", "s.country_id").on("co.is_active", "=", true))
        .select(["s.id", "s.name", "s.search_name", sql<number>`0`.as("population"), sql<string | null>`null`.as("region_name"), "co.name as country_name", "co.name_tr as country_name_tr", "co.iso2 as country_code", "co.emoji as country_emoji", kindColumn("state").as("kind")])
        .where("s.is_active", "=", true).where("s.id", "=", id).executeTakeFirst()
      : database
        .selectFrom("location_countries as co")
        .select(["co.id", "co.name", "co.search_name", sql<number>`0`.as("population"), sql<string | null>`null`.as("region_name"), "co.name as country_name", "co.name_tr as country_name_tr", "co.iso2 as country_code", "co.emoji as country_emoji", kindColumn("country").as("kind")])
        .where("co.is_active", "=", true).where("co.id", "=", id).executeTakeFirst());

  const suggestion = row ? toSuggestion(row as unknown as SuggestionRow, locale) : null;
  if (suggestion) await setCachedJson(cacheKey, suggestion, REFERENCE_CACHE_SECONDS);
  return suggestion;
};

/**
 * Nearest settlement to a raw fix. This turns a coordinate into something the
 * member can be *offered* - "set your profile location to Nilüfer, Bursa?" -
 * and is never written to the profile without an explicit confirmation.
 */
export const findNearestCity = async (
  latitude: number,
  longitude: number,
): Promise<{ id: number; name: string; regionName: string | null; countryName: string; countryNameTr: string; countryCode: string; countryEmoji: string } | null> => {
  const row = await database
    .selectFrom("location_cities as c")
    .innerJoin("location_countries as co", (join) => join.onRef("co.id", "=", "c.country_id").on("co.is_active", "=", true))
    .leftJoin("location_states as s", (join) => join.onRef("s.id", "=", "c.state_id").on("s.is_active", "=", true))
    .select(["c.id", "c.name", "s.name as region_name", "co.name as country_name", "co.name_tr as country_name_tr", "co.iso2 as country_code", "co.emoji as country_emoji"])
    .where("c.is_active", "=", true)
    .where(withinRadius("c", latitude, longitude, REVERSE_LOOKUP_RADIUS_METERS))
    .orderBy(distanceMeters("c", latitude, longitude))
    .limit(1)
    .executeTakeFirst();

  return row
    ? {
      id: row.id,
      name: row.name,
      regionName: row.region_name,
      countryName: row.country_name,
      countryNameTr: row.country_name_tr,
      countryCode: row.country_code,
      countryEmoji: row.country_emoji,
    }
    : null;
};

/** Coarse "you appear to be around here" label; never a street or a postcode. */
export const describeCity = async (cityId: number | null): Promise<string | null> => {
  if (cityId === null) return null;
  const row = await database
    .selectFrom("location_cities as c")
    .leftJoin("location_states as s", (join) => join.onRef("s.id", "=", "c.state_id"))
    .select(["c.name", "s.name as region_name"])
    .where("c.id", "=", cityId)
    .executeTakeFirst();
  return row ? formatAreaLabel({ city: row.name, region: row.region_name !== row.name ? row.region_name : null }) : null;
};

const emptyProfileLocation: ProfileLocation = {
  countryId: null, stateId: null, cityId: null, displayName: "", countryCode: "",
  source: null, visibility: "public", selectedAt: null,
};

interface ProfileLocationRow {
  location: string;
  location_country_id: number | null;
  location_state_id: number | null;
  location_city_id: number | null;
  location_source: string;
  location_visibility: ProfileLocationVisibility;
  location_selected_at: Date | null;
  country_code: string | null;
}

const toProfileLocation = (row: ProfileLocationRow): ProfileLocation => ({
  countryId: row.location_country_id,
  stateId: row.location_state_id,
  cityId: row.location_city_id,
  displayName: row.location,
  countryCode: row.country_code ?? "",
  source: (row.location_source || null) as ProfileLocationSource | null,
  visibility: row.location_visibility,
  selectedAt: row.location_selected_at ? new Date(row.location_selected_at).toISOString() : null,
});

export const getProfileLocation = async (userId: string): Promise<ProfileLocation> => {
  const row = await database
    .selectFrom("users as u")
    .leftJoin("location_countries as co", "co.id", "u.location_country_id")
    .select(["u.location", "u.location_country_id", "u.location_state_id", "u.location_city_id", "u.location_source", "u.location_visibility", "u.location_selected_at", "co.iso2 as country_code"])
    .where("u.id", "=", userId)
    .executeTakeFirst();
  return row ? toProfileLocation(row as ProfileLocationRow) : emptyProfileLocation;
};

/**
 * Resolves the chosen record, walks up to its parents and stores all three ids
 * plus the label the backend rendered. Storing the ancestry - not just the leaf
 * - is what lets "same country" and "same region" filters work later without a
 * join per row.
 */
export const saveProfileLocation = async (
  userId: string,
  selection: { kind: LocationKind; id: number },
  options: { source: ProfileLocationSource; visibility?: ProfileLocationVisibility | null; locale: Locale },
): Promise<ProfileLocation | null> => {
  const resolved = await resolveHierarchy(selection.kind, selection.id);
  if (!resolved) return null;

  const country = options.locale === "tr" && resolved.countryNameTr ? resolved.countryNameTr : resolved.countryName;
  const label = formatLocationLabel({ city: resolved.cityName, region: resolved.stateName, country }).slice(0, MAX_LABEL_LENGTH);

  await database
    .updateTable("users")
    .set({
      location: label,
      location_country_id: resolved.countryId,
      location_state_id: resolved.stateId,
      location_city_id: resolved.cityId,
      location_source: options.source,
      location_selected_at: new Date(),
      ...(options.visibility ? { location_visibility: options.visibility } : {}),
    })
    .where("id", "=", userId)
    .execute();

  await Promise.all([invalidateCachePrefix(`profile:${userId}:`), rememberRecentSelection(userId, selection)]);
  return getProfileLocation(userId);
};

export const clearProfileLocation = async (userId: string): Promise<ProfileLocation> => {
  await database
    .updateTable("users")
    .set({ location: "", location_country_id: null, location_state_id: null, location_city_id: null, location_source: "", location_selected_at: null })
    .where("id", "=", userId)
    .execute();
  await invalidateCachePrefix(`profile:${userId}:`);
  return getProfileLocation(userId);
};

export const updateProfileLocationVisibility = async (userId: string, visibility: ProfileLocationVisibility): Promise<ProfileLocation> => {
  await database.updateTable("users").set({ location_visibility: visibility }).where("id", "=", userId).execute();
  await invalidateCachePrefix(`profile:${userId}:`);
  return getProfileLocation(userId);
};

interface ResolvedHierarchy {
  countryId: number; stateId: number | null; cityId: number | null;
  cityName: string | null; stateName: string | null; countryName: string; countryNameTr: string;
}

/** Turns any one of the three ids into the full country/state/city triple. */
const resolveHierarchy = async (kind: LocationKind, id: number): Promise<ResolvedHierarchy | null> => {
  if (kind === "city") {
    const row = await database
      .selectFrom("location_cities as c")
      .innerJoin("location_countries as co", (join) => join.onRef("co.id", "=", "c.country_id").on("co.is_active", "=", true))
      .leftJoin("location_states as s", (join) => join.onRef("s.id", "=", "c.state_id").on("s.is_active", "=", true))
      .select(["c.id as city_id", "c.name as city_name", "s.id as state_id", "s.name as state_name", "co.id as country_id", "co.name as country_name", "co.name_tr as country_name_tr"])
      .where("c.is_active", "=", true).where("c.id", "=", id).executeTakeFirst();
    if (!row) return null;
    return {
      countryId: row.country_id,
      stateId: row.state_id,
      cityId: row.city_id,
      cityName: row.city_name,
      // A district named after its province reads as a duplicate in the label.
      stateName: row.state_name && row.state_name !== row.city_name ? row.state_name : null,
      countryName: row.country_name,
      countryNameTr: row.country_name_tr,
    };
  }

  if (kind === "state") {
    const row = await database
      .selectFrom("location_states as s")
      .innerJoin("location_countries as co", (join) => join.onRef("co.id", "=", "s.country_id").on("co.is_active", "=", true))
      .select(["s.id as state_id", "s.name as state_name", "co.id as country_id", "co.name as country_name", "co.name_tr as country_name_tr"])
      .where("s.is_active", "=", true).where("s.id", "=", id).executeTakeFirst();
    if (!row) return null;
    return { countryId: row.country_id, stateId: row.state_id, cityId: null, cityName: null, stateName: row.state_name, countryName: row.country_name, countryNameTr: row.country_name_tr };
  }

  const row = await database
    .selectFrom("location_countries as co")
    .select(["co.id as country_id", "co.name as country_name", "co.name_tr as country_name_tr"])
    .where("co.is_active", "=", true).where("co.id", "=", id).executeTakeFirst();
  if (!row) return null;
  return { countryId: row.country_id, stateId: null, cityId: null, cityName: null, stateName: null, countryName: row.country_name, countryNameTr: row.country_name_tr };
};

/**
 * Recent picks live in Redis, not PostgreSQL. They are a convenience that may
 * evaporate on a cache flush without anyone noticing, and keeping them out of
 * the database means one less place holding a trail of where someone has been.
 */
const recentKey = (userId: string): string => `loc:recent:${userId}`;

const rememberRecentSelection = async (userId: string, selection: { kind: LocationKind; id: number }): Promise<void> => {
  const existing = (await getCachedJson<Array<{ kind: LocationKind; id: number }>>(recentKey(userId))) ?? [];
  const next = [selection, ...existing.filter((entry) => !(entry.kind === selection.kind && entry.id === selection.id))].slice(0, MAX_RECENT_ENTRIES);
  await setCachedJson(recentKey(userId), next, RECENT_CACHE_SECONDS);
};

export const listRecentSelections = async (userId: string, locale: Locale): Promise<LocationSuggestion[]> => {
  const entries = (await getCachedJson<Array<{ kind: LocationKind; id: number }>>(recentKey(userId))) ?? [];
  const resolved = await Promise.all(entries.map((entry) => findSuggestion(entry.kind, entry.id, locale)));
  return resolved.filter((suggestion): suggestion is LocationSuggestion => suggestion !== null);
};

export const clearRecentSelections = async (userId: string): Promise<void> => {
  await setCachedJson(recentKey(userId), [], RECENT_CACHE_SECONDS);
};
