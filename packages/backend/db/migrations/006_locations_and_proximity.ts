import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

// Two independent features land in this migration because they share the
// reference tables but nothing else:
//
//   1. Profile location - a place the athlete picks from the Countries States
//      Cities dataset. Coarse, public, and never changed without consent.
//   2. Nearby - the device GPS fix, kept in its own table so that deleting it,
//      or switching the feature off, cannot touch the profile.
//
// The dataset keeps its own integer identifiers. Reusing them (instead of
// minting uuids) is what makes a dataset refresh a plain upsert and lets a
// user's saved city survive it.
//
// Geometry: coordinates always live in plain `double precision` columns, so
// every deployment can run proximity queries with a bounding box plus the
// haversine formula. Where PostGIS is installed - the intended production
// setup - a generated `geography(Point,4326)` column and a GiST index are added
// on top and the service switches to ST_DWithin. Local PostgreSQL builds
// without the extension keep working with the portable path; nothing else in
// the schema changes.
const POSTGIS_TABLES = ["location_cities", "user_locations"] as const;

const addPostgisColumns = async (db: Kysely<Database>): Promise<void> => {
  for (const table of POSTGIS_TABLES) {
    await sql.raw(`
      ALTER TABLE ${table}
        ADD COLUMN geo geography(Point, 4326)
        GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED;
      CREATE INDEX ${table}_geo_idx ON ${table} USING gist (geo);
    `).execute(db);
  }
};

export const up = async (db: Kysely<Database>): Promise<void> => {
  // Trigram search powers the "contains" half of the autocomplete. It ships with
  // every supported PostgreSQL, so a failure here is a real problem worth
  // surfacing rather than swallowing.
  await sql.raw(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`).execute(db);

  await sql.raw(`
    -- ── Reference data ──────────────────────────────────────────────────────
    -- Only the columns the app actually reads are imported. The dataset also
    -- carries currency, tld, gdp, wikidata ids and machine translations for
    -- every row; none of that is used, so none of it is stored.
    CREATE TABLE location_countries (
      id integer PRIMARY KEY,
      name varchar(120) NOT NULL,
      -- Turkish label from the dataset's own translation table. Only country
      -- names are taken from it: the state and city translations are machine
      -- generated and produce wrong words for real places.
      name_tr varchar(120) NOT NULL DEFAULT '',
      native_name varchar(120) NOT NULL DEFAULT '',
      iso2 char(2) NOT NULL UNIQUE,
      iso3 char(3) NOT NULL,
      phone_code varchar(16) NOT NULL DEFAULT '',
      emoji varchar(16) NOT NULL DEFAULT '',
      latitude double precision,
      longitude double precision,
      -- Accent-folded, lower-cased, Turkish-aware search key. Built by the
      -- importer so the query path never has to normalise a stored value.
      search_name varchar(200) NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      dataset_version varchar(48) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX location_countries_search_idx ON location_countries (search_name varchar_pattern_ops) WHERE is_active;
    CREATE INDEX location_countries_trgm_idx ON location_countries USING gin (search_name gin_trgm_ops);

    -- "State" means province in Turkey, state in the US, Land in Germany and so
    -- on. The "type" column keeps whatever the dataset called it, so the UI can
    -- label the field honestly instead of guessing.
    CREATE TABLE location_states (
      id integer PRIMARY KEY,
      country_id integer NOT NULL REFERENCES location_countries(id) ON DELETE CASCADE,
      name varchar(160) NOT NULL,
      state_code varchar(16) NOT NULL DEFAULT '',
      type varchar(48) NOT NULL DEFAULT '',
      latitude double precision,
      longitude double precision,
      search_name varchar(240) NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      dataset_version varchar(48) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX location_states_search_idx ON location_states (search_name varchar_pattern_ops) WHERE is_active;
    CREATE INDEX location_states_trgm_idx ON location_states USING gin (search_name gin_trgm_ops);
    CREATE INDEX location_states_country_idx ON location_states (country_id, search_name);

    CREATE TABLE location_cities (
      id integer PRIMARY KEY,
      country_id integer NOT NULL REFERENCES location_countries(id) ON DELETE CASCADE,
      state_id integer REFERENCES location_states(id) ON DELETE SET NULL,
      name varchar(160) NOT NULL,
      latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
      longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      -- Used only to rank equally good text matches; a search for "Cambridge"
      -- should offer the larger one first.
      population bigint NOT NULL DEFAULT 0 CHECK (population >= 0),
      search_name varchar(240) NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      dataset_version varchar(48) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX location_cities_search_idx ON location_cities (search_name varchar_pattern_ops) WHERE is_active;
    CREATE INDEX location_cities_trgm_idx ON location_cities USING gin (search_name gin_trgm_ops);
    CREATE INDEX location_cities_country_idx ON location_cities (country_id, search_name);
    -- Reverse lookup ("which city is this fix in?") scans a narrow latitude
    -- band first; the longitude filter then runs over a few hundred rows.
    CREATE INDEX location_cities_lat_lon_idx ON location_cities (latitude, longitude);

    -- ── Profile location ────────────────────────────────────────────────────
    -- The existing users.location column stays as the rendered label so every
    -- current reader keeps working, but from now on the backend writes it and
    -- the three ids below are the source of truth.
    ALTER TABLE users
      ADD COLUMN location_country_id integer REFERENCES location_countries(id) ON DELETE SET NULL,
      ADD COLUMN location_state_id integer REFERENCES location_states(id) ON DELETE SET NULL,
      ADD COLUMN location_city_id integer REFERENCES location_cities(id) ON DELETE SET NULL,
      ADD COLUMN location_source varchar(24) NOT NULL DEFAULT '',
      ADD COLUMN location_visibility varchar(16) NOT NULL DEFAULT 'public'
        CHECK (location_visibility IN ('public', 'followers', 'connections', 'private')),
      ADD COLUMN location_selected_at timestamptz;
    CREATE INDEX users_location_city_idx ON users (location_city_id) WHERE location_city_id IS NOT NULL;

    -- ── Nearby (sensitive) ──────────────────────────────────────────────────
    -- One row per member, dropped entirely when the member turns the feature
    -- off or deletes the account. Nothing here is ever serialised to a client:
    -- the API answers with a distance band and a coarse area label only.
    CREATE TABLE user_locations (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
      longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      accuracy_meters numeric(10,2) CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
      source varchar(16) NOT NULL DEFAULT 'gps' CHECK (source IN ('gps', 'network', 'coarse')),
      -- Resolved once on write so the nearby query never geocodes per request.
      city_id integer REFERENCES location_cities(id) ON DELETE SET NULL,
      enabled boolean NOT NULL DEFAULT false,
      -- Lets a member browse nearby athletes without appearing in their lists.
      visible boolean NOT NULL DEFAULT true,
      distance_visibility varchar(16) NOT NULL DEFAULT 'approximate'
        CHECK (distance_visibility IN ('approximate', 'nearby_only', 'hidden')),
      scope varchar(8) NOT NULL DEFAULT '25km'
        CHECK (scope IN ('5km', '10km', '25km', '50km', 'city')),
      permission_status varchar(24) NOT NULL DEFAULT 'unknown',
      location_updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    -- Every proximity query starts from "listed, still fresh", so the partial
    -- index carries the freshness column and skips opted-out rows entirely.
    CREATE INDEX user_locations_listed_idx
      ON user_locations (location_updated_at DESC, latitude, longitude)
      WHERE enabled AND visible;
    CREATE INDEX user_locations_city_idx ON user_locations (city_id) WHERE enabled AND visible;

    CREATE TRIGGER location_countries_set_updated_at BEFORE UPDATE ON location_countries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER location_states_set_updated_at BEFORE UPDATE ON location_states FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER location_cities_set_updated_at BEFORE UPDATE ON location_cities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER user_locations_set_updated_at BEFORE UPDATE ON user_locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `).execute(db);

  // PostGIS is optional on purpose. Managed PostgreSQL (RDS, Cloud SQL) offers
  // it; a plain local install usually does not, and the feature must still be
  // developable there.
  //
  // Availability is checked before CREATE EXTENSION rather than after: the
  // migrator wraps this function in a transaction, so a failed statement would
  // poison it and take the whole migration down with it - a try/catch around
  // the CREATE is too late to help.
  const postgis = await sql<{ available: boolean }>`
    select exists (select 1 from pg_available_extensions where name = 'postgis') as available
  `.execute(db);
  if (postgis.rows[0]?.available) {
    await sql.raw(`CREATE EXTENSION IF NOT EXISTS postgis;`).execute(db);
    await addPostgisColumns(db);
  }
  // Otherwise the portable bounding-box path stays in use; locationGeometry.ts
  // probes for the generated column at boot and picks the matching SQL.
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    DROP TABLE IF EXISTS user_locations;
    DROP INDEX IF EXISTS users_location_city_idx;
    ALTER TABLE users
      DROP COLUMN IF EXISTS location_country_id,
      DROP COLUMN IF EXISTS location_state_id,
      DROP COLUMN IF EXISTS location_city_id,
      DROP COLUMN IF EXISTS location_source,
      DROP COLUMN IF EXISTS location_visibility,
      DROP COLUMN IF EXISTS location_selected_at;
    DROP TABLE IF EXISTS location_cities;
    DROP TABLE IF EXISTS location_states;
    DROP TABLE IF EXISTS location_countries;
  `).execute(db);
};
