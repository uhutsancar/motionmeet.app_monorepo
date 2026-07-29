import "dotenv/config";
import connectDB, { disconnectDB } from "../configs/db.js";

const apply = process.argv.includes("--apply");
process.env.MONGODB_MAX_TIME_MS ||= "600000";
const LEGACY_DATABASE = "test";

try {
  const connection = await connectDB();
  const targetName = connection.name;
  if (targetName === LEGACY_DATABASE) {
    throw new Error("Target database cannot be the legacy test database");
  }

  const source = connection.client.db(LEGACY_DATABASE);
  const target = connection.client.db(targetName);
  const collections = (await source.listCollections({}, { nameOnly: true }).toArray())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("system."));

  const report = [];
  for (const name of collections) {
    const sourceCount = await source.collection(name).estimatedDocumentCount();
    const targetCount = await target.collection(name).estimatedDocumentCount();
    report.push({ collection: name, sourceCount, targetCount });
    if (apply && sourceCount > 0) {
      await source.collection(name).aggregate([
        {
          $merge: {
            into: { db: targetName, coll: name },
            on: "_id",
            whenMatched: "keepExisting",
            whenNotMatched: "insert",
          },
        },
      ]).toArray();
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    sourceDatabase: LEGACY_DATABASE,
    targetDatabase: targetName,
    sourceLeftIntact: true,
    collections: report,
  }, null, 2));
} catch (error) {
  console.error("Database namespace migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
