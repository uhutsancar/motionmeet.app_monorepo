import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectDatabase, disconnectDatabase, withTransaction } from "../configs/database.js";

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;
const stringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
const objectEntries = (value: unknown): Array<[string, unknown]> => Object.entries(record(value));
const datasetPath = path.resolve(process.cwd(), "../../exercises-dataset-main/data/exercises.json");
try {
  await connectDatabase(); const parsed: unknown = JSON.parse(await readFile(datasetPath, "utf8")); if (!Array.isArray(parsed)) throw new Error("Exercise dataset must be an array");
  const cdn = `${process.env.CDN_URL?.replace(/\/$/, "") || "https://motionmeet-assets.s3.eu-north-1.amazonaws.com"}/exercises`;
  let processed = 0;
  for (let offset = 0; offset < parsed.length; offset += 200) {
    const batch = parsed.slice(offset, offset + 200);
    await withTransaction(async (transaction) => {
      for (const candidate of batch) {
        const item = record(candidate); const externalId = text(item.id); const name = text(item.name).trim(); if (!externalId || !name) continue;
        const image = text(item.image); const gif = text(item.gif_url, text(item.gifUrl));
        const exercise = await transaction.insertInto("exercises").values({ legacy_mongo_id: null, external_id: externalId, name, name_normalized: name.toLocaleLowerCase("en-US"), muscle_group: text(item.body_part, text(item.category, "other")), target: text(item.target), category: text(item.category), equipment: text(item.equipment, "bodyweight"), image_url: image ? `${cdn}/${image}` : "", image_key: image ? `exercises/${image}` : "", gif_url: gif ? `${cdn}/${gif}` : "", gif_key: gif ? `exercises/${gif}` : "", is_custom: false, created_by: null })
          .onConflict((conflict) => conflict.column("external_id").doUpdateSet({ name, name_normalized: name.toLocaleLowerCase("en-US"), image_url: image ? `${cdn}/${image}` : "", gif_url: gif ? `${cdn}/${gif}` : "" })).returning("id").executeTakeFirstOrThrow();
        await transaction.deleteFrom("exercise_secondary_muscles").where("exercise_id", "=", exercise.id).execute();
        for (const [position, muscle] of stringList(item.secondary_muscles).entries()) await transaction.insertInto("exercise_secondary_muscles").values({ exercise_id: exercise.id, muscle, position }).execute();
        await transaction.deleteFrom("exercise_instructions").where("exercise_id", "=", exercise.id).execute();
        const summaries = new Map(objectEntries(item.instructions).map(([language, value]) => [language, text(value)])); const steps = new Map(objectEntries(item.instruction_steps).map(([language, value]) => [language, stringList(value)]));
        for (const language of new Set([...summaries.keys(), ...steps.keys()])) await transaction.insertInto("exercise_instructions").values({ exercise_id: exercise.id, language, summary: summaries.get(language) ?? "", steps: steps.get(language) ?? [] }).execute();
      }
    });
    processed += batch.length; console.log(`Exercise seed: ${processed}/${parsed.length}`);
  }
} catch (error: unknown) { console.error("Exercise seed failed:", error instanceof Error ? error.message : error); process.exitCode = 1; }
finally { await disconnectDatabase().catch(() => undefined); }
