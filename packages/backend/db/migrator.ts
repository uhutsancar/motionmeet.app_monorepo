import { Migrator, type MigrationProvider } from "kysely/migration";
import { database } from "../configs/database.js";
import * as initialPostgresqlMigration from "./migrations/001_initial_postgresql.js";
import * as partialIdempotencyIndexes from "./migrations/002_partial_idempotency_indexes.js";
import * as detachedExerciseSnapshots from "./migrations/003_detached_exercise_snapshots.js";

const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return {
      "001_initial_postgresql": initialPostgresqlMigration,
      "002_partial_idempotency_indexes": partialIdempotencyIndexes,
      "003_detached_exercise_snapshots": detachedExerciseSnapshots,
    };
  },
};

export const migrateToLatest = async (): Promise<void> => {
  const migrator = new Migrator({
    db: database,
    provider: migrationProvider,
  });
  const { error, results } = await migrator.migrateToLatest();
  for (const result of results ?? []) {
    console.log(`Migration ${result.migrationName}: ${result.status}`);
  }
  if (error) throw error;
};
