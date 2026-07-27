import "dotenv/config";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";

const applyChanges = process.argv.includes("--apply");
const argumentValue = (name, fallback) => {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length).trim() : fallback;
};

const sourceName = argumentValue("source", "test");
const targetName = argumentValue(
  "target",
  process.env.MONGODB_DB_NAME?.trim() || "motionmeet"
);
const databaseUrl = process.env.MONGODB_URL?.trim();

if (!databaseUrl) throw new Error("MONGODB_URL is required");
if (!sourceName || !targetName || sourceName === targetName) {
  throw new Error("Source and target database names must be different");
}
if (["admin", "config", "local"].includes(sourceName.toLowerCase())) {
  throw new Error("System databases cannot be used as a migration source");
}
if (["admin", "config", "local", "test"].includes(targetName.toLowerCase())) {
  throw new Error("Target must be an explicit non-system application database");
}

const NATURAL_KEYS = {
  connections: [["pairKey"]],
  equipment: [["code"]],
  exercises: [["externalId"]],
  mediadeletionjobs: [["key"]],
  musclegroups: [["code"]],
  passwordresettokens: [["tokenHash"]],
  plans: [["name"]],
  postlikes: [["postId", "userId"]],
  uploadreservations: [["key"]],
  usages: [["userId", "bucket"]],
  users: [["email"], ["username"]],
};

const COPY_ORDER = [
  "plans",
  "equipment",
  "musclegroups",
  "users",
  "exercises",
  "workouts",
  "routines",
  "posts",
  "postlikes",
  "postcomments",
  "connections",
  "messages",
  "stories",
  "usages",
  "sessions",
  "passwordresettokens",
  "uploadreservations",
  "mediadeletionjobs",
];

const naturalFilter = (document, fields) => {
  if (fields.some((field) => document[field] === undefined || document[field] === null)) {
    return null;
  }
  return Object.fromEntries(fields.map((field) => [field, document[field]]));
};

const main = async () => {
  mongoose.set("autoIndex", false);
  await mongoose.connect(databaseUrl, {
    dbName: sourceName,
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });

  const client = mongoose.connection.getClient();
  const source = client.db(sourceName);
  const target = client.db(targetName);
  const sourceCollections = new Set(
    (await source.listCollections({}, { nameOnly: true }).toArray()).map(
      ({ name }) => name
    )
  );
  const targetCollections = new Set(
    (await target.listCollections({}, { nameOnly: true }).toArray()).map(
      ({ name }) => name
    )
  );

  const sourcePlans = sourceCollections.has("plans")
    ? await source.collection("plans").find({}).toArray()
    : [];
  const targetPlans = targetCollections.has("plans")
    ? await target.collection("plans").find({}).toArray()
    : [];
  const targetPlanByName = new Map(targetPlans.map((plan) => [plan.name, plan]));
  const sourcePlanNameById = new Map(
    sourcePlans.map((plan) => [plan._id.toString(), plan.name])
  );

  const transforms = {
    users(document) {
      if (!document.plan) return document;
      const planName = sourcePlanNameById.get(document.plan.toString());
      const targetPlan = planName ? targetPlanByName.get(planName) : null;
      if (!targetPlan) {
        throw new Error(
          `Cannot map a source user plan into ${targetName}; ensure matching plan names exist first`
        );
      }
      return { ...document, plan: targetPlan._id };
    },
  };

  const summary = [];
  const pendingByCollection = new Map();
  const conflicts = [];

  for (const collectionName of COPY_ORDER) {
    if (!sourceCollections.has(collectionName)) continue;
    const documents = await source.collection(collectionName).find({}).toArray();
    const pending = [];
    let alreadyPresent = 0;

    for (const original of documents) {
      // Plans and canonical lookup data are merged by their natural key. Existing
      // target definitions win so administrator-managed values are never replaced.
      const transform = transforms[collectionName];
      const document = transform ? transform(original) : original;
      const existingById = targetCollections.has(collectionName)
        ? await target.collection(collectionName).findOne({ _id: document._id })
        : null;

      if (existingById) {
        if (isDeepStrictEqual(existingById, document)) {
          alreadyPresent += 1;
        } else {
          conflicts.push({
            collection: collectionName,
            type: "_id",
          });
        }
        continue;
      }

      let naturalMatch = null;
      for (const fields of NATURAL_KEYS[collectionName] || []) {
        const filter = naturalFilter(document, fields);
        if (!filter || !targetCollections.has(collectionName)) continue;
        const match = await target
          .collection(collectionName)
          .findOne(filter, { projection: { _id: 1 } });
        if (match) {
          naturalMatch = { fields, id: match._id };
          break;
        }
      }

      if (naturalMatch) {
        if (["plans", "equipment", "musclegroups"].includes(collectionName)) {
          alreadyPresent += 1;
        } else {
          conflicts.push({
            collection: collectionName,
            type: naturalMatch.fields.join("+"),
          });
        }
        continue;
      }

      pending.push(document);
    }

    pendingByCollection.set(collectionName, pending);
    summary.push({
      collection: collectionName,
      source: documents.length,
      alreadyPresent,
      toInsert: pending.length,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: applyChanges ? "apply" : "dry-run",
        source: sourceName,
        target: targetName,
        collections: summary,
        conflicts,
      },
      null,
      2
    )
  );

  if (conflicts.length) {
    throw new Error(
      "Migration stopped because target conflicts require manual resolution"
    );
  }
  if (!applyChanges) {
    console.log(
      "Dry run complete. Re-run with --apply after reviewing the report; the source database will be preserved."
    );
    return;
  }

  for (const collectionName of COPY_ORDER) {
    const documents = pendingByCollection.get(collectionName) || [];
    if (!documents.length) continue;
    await target.collection(collectionName).insertMany(documents, {
      ordered: true,
    });
  }

  console.log(
    `Database namespace migration completed. Source ${sourceName} was not modified or deleted.`
  );
};

try {
  await main();
} catch (error) {
  console.error("Database namespace migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
