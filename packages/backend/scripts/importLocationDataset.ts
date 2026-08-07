import "dotenv/config";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { sql } from "kysely";
import { connectDatabase, database, disconnectDatabase } from "../configs/database.js";
import { normalizeLocationName } from "../utils/locationText.js";
import type { NewRow } from "../db/types.js";

/**
 * Imports the Countries States Cities dataset into PostgreSQL.
 *
 *   pnpm --filter @motionmeet/backend run import:locations
 *
 * Deliberately partial. The upstream export carries currency codes, TLDs, GDP,
 * postal-code regexes, timezone tables, wikidata ids and machine translations
 * into nineteen languages for every one of its 158k rows. MotionMeet reads a
 * name, a parent, a coordinate pair and - for cities - a population used only
 * to break ranking ties, so that is all this script keeps. Country names are
 * the single exception: their Turkish translation is taken as well, because it
 * is human-curated. State and city translations are not, and produce wrong
 * words for real places ("Bursa" arrives as the German for a bursa sac).
 *
 * Re-running is safe and is the intended way to pick up a dataset refresh:
 * every row is upserted by its dataset id and records that disappeared
 * upstream are flagged inactive rather than deleted, so a member whose profile
 * points at one keeps their location.
 *
 * Licence: ODbL v1.0. Attribution must ship with the app - see docs/LICENSES.md.
 */

/**
 * Pinned so two machines importing on different days get identical data. Bump
 * deliberately, run against staging first, and read the summary this script
 * prints for rows that went inactive.
 */
const DATASET_VERSION = "v3.2-export.7";
const REPOSITORY = "dr5hn/countries-states-cities-database";

// Countries and states are small enough to live in the repository tree; cities
// only exist as a release asset because git rejects the uncompressed file.
const SOURCES = {
  countries: { url: `https://raw.githubusercontent.com/${REPOSITORY}/${DATASET_VERSION}/json/countries.json`, gzip: false },
  states: { url: `https://raw.githubusercontent.com/${REPOSITORY}/${DATASET_VERSION}/json/states.json`, gzip: false },
  cities: { url: `https://github.com/${REPOSITORY}/releases/download/${DATASET_VERSION}/json-cities.json.gz`, gzip: true },
} as const;

const CACHE_DIRECTORY = path.resolve(process.cwd(), ".location-dataset", DATASET_VERSION);
/**
 * Rows per INSERT. Cities carry ten bound parameters each, so this stays well
 * under the 65535-parameter ceiling of the PostgreSQL wire protocol.
 */
const BATCH_SIZE = 2_000;

interface RawCountry {
  id: number; name: string; iso2: string; iso3: string; native?: string | null;
  phonecode?: string | null; emoji?: string | null;
  latitude?: string | null; longitude?: string | null;
  translations?: Record<string, string> | null;
}
interface RawState {
  id: number; name: string; country_id: number; iso2?: string | null; type?: string | null;
  latitude?: string | null; longitude?: string | null;
}
interface RawCity {
  id: number; name: string; country_id: number; state_id?: number | null;
  latitude: string; longitude: string; population?: number | null;
}

const log = (message: string, detail: Record<string, unknown> = {}): void => {
  const suffix = Object.keys(detail).length ? ` ${JSON.stringify(detail)}` : "";
  console.log(`[locations] ${message}${suffix}`);
};

const download = async (name: keyof typeof SOURCES): Promise<string> => {
  const source = SOURCES[name];
  const cachePath = path.join(CACHE_DIRECTORY, `${name}.json`);
  const cached = await stat(cachePath).catch(() => null);
  if (cached?.isFile() && cached.size > 0) {
    log("using cached source", { name, bytes: cached.size });
    return cachePath;
  }

  await mkdir(CACHE_DIRECTORY, { recursive: true });
  log("downloading", { name, url: source.url });
  const response = await fetch(source.url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`Download failed for ${name}: HTTP ${response.status}`);

  const body = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  await (source.gzip
    ? pipeline(body, createGunzip(), createWriteStream(cachePath))
    : pipeline(body, createWriteStream(cachePath)));
  log("downloaded", { name, bytes: (await stat(cachePath)).size });
  return cachePath;
};

const readJson = async <T>(name: keyof typeof SOURCES): Promise<T[]> => {
  const parsed: unknown = JSON.parse(await readFile(await download(name), "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${name} source is not an array`);
  return parsed as T[];
};

/** Coordinates arrive as strings; anything unparseable becomes null. */
const coordinate = (value: unknown, limit: number): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
};

const truncate = (value: string, length: number): string => (value.length > length ? value.slice(0, length) : value);

const inBatches = async <T>(rows: T[], handle: (batch: T[]) => Promise<void>): Promise<void> => {
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    await handle(rows.slice(offset, offset + BATCH_SIZE));
  }
};

/**
 * Rows that vanished upstream are flagged inactive rather than deleted. That is
 * what keeps `users.location_city_id` valid across a dataset refresh: the
 * search endpoint filters inactive rows out so they stop being selectable,
 * while everyone who already picked one keeps their profile location.
 */
const deactivateStaleRows = async (table: "location_countries" | "location_states" | "location_cities"): Promise<number> => {
  const result = await database
    .updateTable(table)
    .set({ is_active: false })
    .where("dataset_version", "!=", DATASET_VERSION)
    .where("is_active", "=", true)
    .executeTakeFirst();
  return Number(result.numUpdatedRows ?? 0);
};

const importCountries = async (rows: Array<NewRow<"location_countries">>): Promise<void> => {
  await inBatches(rows, async (batch) => {
    await database.insertInto("location_countries").values(batch).onConflict((conflict) =>
      conflict.column("id").doUpdateSet((eb) => ({
        name: eb.ref("excluded.name"),
        name_tr: eb.ref("excluded.name_tr"),
        native_name: eb.ref("excluded.native_name"),
        iso2: eb.ref("excluded.iso2"),
        iso3: eb.ref("excluded.iso3"),
        phone_code: eb.ref("excluded.phone_code"),
        emoji: eb.ref("excluded.emoji"),
        latitude: eb.ref("excluded.latitude"),
        longitude: eb.ref("excluded.longitude"),
        search_name: eb.ref("excluded.search_name"),
        is_active: eb.ref("excluded.is_active"),
        dataset_version: eb.ref("excluded.dataset_version"),
      })),
    ).execute();
  });
};

const importStates = async (rows: Array<NewRow<"location_states">>): Promise<void> => {
  await inBatches(rows, async (batch) => {
    await database.insertInto("location_states").values(batch).onConflict((conflict) =>
      conflict.column("id").doUpdateSet((eb) => ({
        country_id: eb.ref("excluded.country_id"),
        name: eb.ref("excluded.name"),
        state_code: eb.ref("excluded.state_code"),
        type: eb.ref("excluded.type"),
        latitude: eb.ref("excluded.latitude"),
        longitude: eb.ref("excluded.longitude"),
        search_name: eb.ref("excluded.search_name"),
        is_active: eb.ref("excluded.is_active"),
        dataset_version: eb.ref("excluded.dataset_version"),
      })),
    ).execute();
  });
};

const importCities = async (rows: Array<NewRow<"location_cities">>): Promise<void> => {
  await inBatches(rows, async (batch) => {
    await database.insertInto("location_cities").values(batch).onConflict((conflict) =>
      conflict.column("id").doUpdateSet((eb) => ({
        country_id: eb.ref("excluded.country_id"),
        state_id: eb.ref("excluded.state_id"),
        name: eb.ref("excluded.name"),
        latitude: eb.ref("excluded.latitude"),
        longitude: eb.ref("excluded.longitude"),
        population: eb.ref("excluded.population"),
        search_name: eb.ref("excluded.search_name"),
        is_active: eb.ref("excluded.is_active"),
        dataset_version: eb.ref("excluded.dataset_version"),
      })),
    ).execute();
  });
};

const run = async (): Promise<void> => {
  await connectDatabase();

  const [rawCountries, rawStates, rawCities] = await Promise.all([
    readJson<RawCountry>("countries"),
    readJson<RawState>("states"),
    readJson<RawCity>("cities"),
  ]);

  const countries: Array<NewRow<"location_countries">> = rawCountries
    .filter((row) => Number.isInteger(row.id) && typeof row.name === "string" && typeof row.iso2 === "string" && row.iso2.length === 2)
    .map((row) => ({
      id: row.id,
      name: truncate(row.name, 120),
      name_tr: truncate(row.translations?.tr?.trim() || "", 120),
      native_name: truncate(row.native?.trim() || "", 120),
      iso2: row.iso2.toUpperCase(),
      iso3: (row.iso3 || "").toUpperCase().slice(0, 3).padEnd(3, " "),
      phone_code: truncate(String(row.phonecode ?? ""), 16),
      emoji: truncate(row.emoji ?? "", 16),
      latitude: coordinate(row.latitude, 90),
      longitude: coordinate(row.longitude, 180),
      // English, Turkish, native spelling and both ISO codes share one key, so
      // "Turkey", "Türkiye" and "TR" all reach the same row.
      search_name: normalizeLocationName([row.name, row.translations?.tr, row.native, row.iso2, row.iso3].filter(Boolean).join(" ")),
      is_active: true,
      dataset_version: DATASET_VERSION,
    }));
  const countryIds = new Set(countries.map((row) => row.id));

  const states: Array<NewRow<"location_states">> = rawStates
    .filter((row) => Number.isInteger(row.id) && typeof row.name === "string" && countryIds.has(row.country_id))
    .map((row) => ({
      id: row.id,
      country_id: row.country_id,
      name: truncate(row.name, 160),
      state_code: truncate(row.iso2 ?? "", 16),
      type: truncate(row.type ?? "", 48),
      latitude: coordinate(row.latitude, 90),
      longitude: coordinate(row.longitude, 180),
      search_name: normalizeLocationName(row.name),
      is_active: true,
      dataset_version: DATASET_VERSION,
    }));
  const stateIds = new Set(states.map((row) => row.id));

  // A city with no usable coordinate is dropped outright: both the reverse
  // lookup and the nearby query need one, and an unplaceable suggestion is
  // worse than a missing one.
  const cities = rawCities
    .filter((row) => Number.isInteger(row.id) && typeof row.name === "string" && countryIds.has(row.country_id))
    .map((row) => ({
      row,
      latitude: coordinate(row.latitude, 90),
      longitude: coordinate(row.longitude, 180),
      searchName: normalizeLocationName(row.name),
    }))
    .filter((entry): entry is typeof entry & { latitude: number; longitude: number } =>
      entry.latitude !== null && entry.longitude !== null && entry.searchName.length > 0)
    .map(({ row, latitude, longitude, searchName }): NewRow<"location_cities"> => ({
      id: row.id,
      country_id: row.country_id,
      state_id: row.state_id && stateIds.has(row.state_id) ? row.state_id : null,
      name: truncate(row.name, 160),
      latitude,
      longitude,
      population: Number.isFinite(Number(row.population)) && Number(row.population) > 0 ? Math.trunc(Number(row.population)) : 0,
      search_name: searchName,
      is_active: true,
      dataset_version: DATASET_VERSION,
    }));

  log("parsed", {
    countries: countries.length,
    states: states.length,
    cities: cities.length,
    citiesSkipped: rawCities.length - cities.length,
  });

  // Parents first: the child tables carry foreign keys to them.
  await importCountries(countries);
  log("countries imported", { rows: countries.length, deactivated: await deactivateStaleRows("location_countries") });
  await importStates(states);
  log("states imported", { rows: states.length, deactivated: await deactivateStaleRows("location_states") });
  await importCities(cities);
  log("cities imported", { rows: cities.length, deactivated: await deactivateStaleRows("location_cities") });

  // ANALYZE stops the planner from picking a sequential scan over the trigram
  // index on a table that just grew from zero to 150k rows.
  await sql.raw("ANALYZE location_countries, location_states, location_cities").execute(database);

  // These are the exact lookups the feature is specified against, so a silent
  // regression upstream fails the import instead of reaching production.
  const checks = await sql<{ label: string; count: string }>`
    select 'turkey' as label, count(*)::text as count from location_countries where iso2 = 'TR' and is_active
    union all select 'nilufer', count(*)::text from location_cities c join location_states s on s.id = c.state_id
      where c.search_name = 'nilufer' and s.search_name = 'bursa' and c.is_active
    union all select 'orphan_states', count(*)::text from location_states s
      left join location_countries c on c.id = s.country_id where c.id is null
    union all select 'orphan_cities', count(*)::text from location_cities c
      left join location_countries co on co.id = c.country_id where co.id is null
    union all select 'missing_search_name', count(*)::text from location_cities where search_name = ''
  `.execute(database);

  const results = Object.fromEntries(checks.rows.map((row) => [row.label, Number(row.count)]));
  log("quality checks", results);

  const failures = [
    results.turkey === 1 ? null : "Turkey is missing from location_countries",
    results.nilufer === 1 ? null : "Nilüfer/Bursa is not resolvable",
    results.orphan_states === 0 ? null : "states reference a missing country",
    results.orphan_cities === 0 ? null : "cities reference a missing country",
    results.missing_search_name === 0 ? null : "cities are missing a search key",
  ].filter((failure): failure is string => failure !== null);

  if (failures.length) throw new Error(`Dataset quality checks failed: ${failures.join("; ")}`);
  log("import completed", { datasetVersion: DATASET_VERSION });
};

try {
  await run();
} catch (error: unknown) {
  console.error("[locations] import failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
