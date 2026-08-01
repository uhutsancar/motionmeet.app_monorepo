import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../configs/database.js";
import { migrateToLatest } from "../db/migrator.js";

try {
  await connectDatabase();
  await migrateToLatest();
} finally {
  await disconnectDatabase();
}
