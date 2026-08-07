import { sql, type RawBuilder } from "kysely";
import { database } from "../configs/database.js";
import { logger } from "../utils/logger.js";

/**
 * Proximity SQL, in two interchangeable flavours.
 *
 * Managed PostgreSQL (RDS, Cloud SQL) has PostGIS, and migration 006 adds a
 * generated `geography(Point,4326)` column plus a GiST index when it is
 * present. There the radius test is `ST_DWithin`, which is both exact and
 * index-backed.
 *
 * A plain local PostgreSQL usually has no PostGIS and no rights to install it,
 * and the feature still has to be developable there. The fallback narrows the
 * candidate set with a latitude/longitude bounding box - served by an ordinary
 * b-tree index - and then applies the haversine formula to the survivors. Same
 * results, one extra arithmetic pass over a few hundred rows.
 *
 * Both flavours read the same `latitude`/`longitude` columns, so a deployment
 * can gain PostGIS later without a data migration.
 */

const EARTH_RADIUS_METERS = 6_371_000;
/** Metres per degree of latitude; constant enough for a bounding box. */
const METERS_PER_DEGREE_LATITUDE = 111_320;

let postgisEnabled = false;

/**
 * Probed once at boot. The column is generated, so its presence is the single
 * signal that the PostGIS path is usable - the extension alone is not enough
 * if the migration ran before it was installed.
 */
export const detectGeometrySupport = async (): Promise<boolean> => {
  try {
    const result = await sql<{ present: boolean }>`
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'user_locations' and column_name = 'geo'
      ) as present
    `.execute(database);
    postgisEnabled = Boolean(result.rows[0]?.present);
  } catch {
    postgisEnabled = false;
  }
  logger.info("location_geometry_mode", { mode: postgisEnabled ? "postgis" : "bounding-box" });
  return postgisEnabled;
};

export const isPostgisEnabled = (): boolean => postgisEnabled;

/**
 * Longitude degrees covering `meters` at the given latitude. Meridians converge
 * towards the poles, so the span widens; above ~89° it is clamped to a full
 * hemisphere and the haversine filter does the real work.
 */
const longitudeSpan = (latitude: number, meters: number): number => {
  const scale = Math.cos((latitude * Math.PI) / 180);
  if (scale <= 0.017) return 180;
  return Math.min(180, meters / (METERS_PER_DEGREE_LATITUDE * scale));
};

const haversineMeters = (alias: string, latitude: number, longitude: number): RawBuilder<number> => sql<number>`
  (${sql.lit(EARTH_RADIUS_METERS)} * 2 * asin(least(1, sqrt(
    power(sin(radians(${sql.ref(`${alias}.latitude`)} - ${latitude}) / 2), 2)
    + cos(radians(${latitude})) * cos(radians(${sql.ref(`${alias}.latitude`)}))
      * power(sin(radians(${sql.ref(`${alias}.longitude`)} - ${longitude}) / 2), 2)
  ))))
`;

/**
 * Longitude range test that stays correct across the antimeridian: a box
 * centred on +179° has to match -179° too, which a plain BETWEEN would miss.
 */
const longitudeWindow = (alias: string, longitude: number, span: number): RawBuilder<boolean> => {
  const low = longitude - span;
  const high = longitude + span;
  if (span >= 180 || (low >= -180 && high <= 180)) {
    return sql<boolean>`${sql.ref(`${alias}.longitude`)} between ${Math.max(low, -180)} and ${Math.min(high, 180)}`;
  }
  const wrappedLow = low < -180 ? low + 360 : low;
  const wrappedHigh = high > 180 ? high - 360 : high;
  return low < -180
    ? sql<boolean>`(${sql.ref(`${alias}.longitude`)} >= ${wrappedLow} or ${sql.ref(`${alias}.longitude`)} <= ${high})`
    : sql<boolean>`(${sql.ref(`${alias}.longitude`)} >= ${low} or ${sql.ref(`${alias}.longitude`)} <= ${wrappedHigh})`;
};

/** `true` for rows within `meters` of the point. Callers own the alias. */
export const withinRadius = (alias: string, latitude: number, longitude: number, meters: number): RawBuilder<boolean> => {
  if (postgisEnabled) {
    return sql<boolean>`ST_DWithin(${sql.ref(`${alias}.geo`)}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${meters})`;
  }
  const latitudeSpan = meters / METERS_PER_DEGREE_LATITUDE;
  return sql<boolean>`(
    ${sql.ref(`${alias}.latitude`)} between ${Math.max(latitude - latitudeSpan, -90)} and ${Math.min(latitude + latitudeSpan, 90)}
    and ${longitudeWindow(alias, longitude, longitudeSpan(latitude, meters))}
    and ${haversineMeters(alias, latitude, longitude)} <= ${meters}
  )`;
};

/** Great-circle distance in metres from the point to each row. */
export const distanceMeters = (alias: string, latitude: number, longitude: number): RawBuilder<number> =>
  postgisEnabled
    ? sql<number>`ST_Distance(${sql.ref(`${alias}.geo`)}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography)`
    : haversineMeters(alias, latitude, longitude);
