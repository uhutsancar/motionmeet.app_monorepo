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
import * as retireBilling from "./migrations/012_retire_billing.js";
import * as repairConversationLastMessage from "./migrations/013_repair_conversation_last_message.js";
import * as outboxReliability from "./migrations/014_outbox_reliability.js";
import * as postsAuthorTimelineIndex from "./migrations/015_posts_author_timeline_index.js";
import * as messageSync from "./migrations/016_message_sync.js";
import * as commentOperationId from "./migrations/017_comment_operation_id.js";
import * as refreshRotationGrace from "./migrations/018_refresh_rotation_grace.js";
import * as foreignKeyIndexes from "./migrations/019_foreign_key_indexes.js";
import * as schedulerLeases from "./migrations/020_scheduler_leases.js";

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
      "012_retire_billing": retireBilling,
      "013_repair_conversation_last_message": repairConversationLastMessage,
      "014_outbox_reliability": outboxReliability,
      "015_posts_author_timeline_index": postsAuthorTimelineIndex,
      "016_message_sync": messageSync,
      "017_comment_operation_id": commentOperationId,
      "018_refresh_rotation_grace": refreshRotationGrace,
      "019_foreign_key_indexes": foreignKeyIndexes,
      "020_scheduler_leases": schedulerLeases,
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
