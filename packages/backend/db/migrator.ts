import { Migrator, type MigrationProvider } from "kysely/migration";
import { createMaintenanceDatabase } from "../configs/database.js";
import * as initialPostgresqlMigration from "./migrations/001_initial_postgresql.js";
import * as partialIdempotencyIndexes from "./migrations/002_partial_idempotency_indexes.js";
import * as detachedExerciseSnapshots from "./migrations/003_detached_exercise_snapshots.js";
import * as bodyMeasurements from "./migrations/004_body_measurements.js";
import * as exerciseMediaPathStyle from "./migrations/005_exercise_media_path_style.js";
import * as locationsAndProximity from "./migrations/006_locations_and_proximity.js";
import * as followRequestsAndNotifications from "./migrations/007_follow_requests_and_notifications.js";
import * as storyOverlays from "./migrations/008_story_overlays.js";
import * as userSearchIndexes from "./migrations/009_user_search_indexes.js";
import * as storyLikes from "./migrations/010_story_likes.js";

const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return {
      "001_initial_postgresql": initialPostgresqlMigration,
      "002_partial_idempotency_indexes": partialIdempotencyIndexes,
      "003_detached_exercise_snapshots": detachedExerciseSnapshots,
      "004_body_measurements": bodyMeasurements,
      "005_exercise_media_path_style": exerciseMediaPathStyle,
      "006_locations_and_proximity": locationsAndProximity,
      "007_follow_requests_and_notifications": followRequestsAndNotifications,
      "008_story_overlays": storyOverlays,
      "009_user_search_indexes": userSearchIndexes,
      "010_story_likes": storyLikes,
    };
  },
};

export const migrateToLatest = async (): Promise<void> => {
  // Not the request pool: an index build on a large table runs far past the
  // statement timeout that pool applies, and being cut off mid-migration is
  // worse than a slow boot.
  const db = createMaintenanceDatabase();
  try {
    const migrator = new Migrator({ db, provider: migrationProvider });
    const { error, results } = await migrator.migrateToLatest();
    for (const result of results ?? []) {
      console.log(`Migration ${result.migrationName}: ${result.status}`);
    }
    if (error) throw error;
  } finally {
    await db.destroy();
  }
};
