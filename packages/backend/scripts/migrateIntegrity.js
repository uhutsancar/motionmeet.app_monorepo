import "dotenv/config";
import connectDB, { disconnectDB } from "../configs/db.js";
import {
  applyIntegrityMigration,
  getIntegrityMigrationStatus,
} from "../services/databaseMigrationService.js";

const apply = process.argv.includes("--apply");
process.env.MONGODB_MAX_TIME_MS ||= "600000";

try {
  await connectDB();
  const result = apply
    ? await applyIntegrityMigration()
    : await getIntegrityMigrationStatus();
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...result }, null, 2));
  if (
    !apply &&
    (result.unsafeDuplicates.length ||
      result.unsafeRelations.length ||
      result.missingIndexes.length ||
      !result.applied ||
      !result.checksumMatches)
  ) {
    process.exitCode = 2;
  }
} catch (error) {
  console.error("Integrity migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
