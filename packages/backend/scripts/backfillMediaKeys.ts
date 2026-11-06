import "dotenv/config";
import { sql } from "kysely";
import { connectDatabase, database, disconnectDatabase } from "../configs/database.js";
import { extractS3Key } from "../utils/s3Utils.js";

/**
 * Fills in missing object keys from stored URLs: `backfill:media-keys [--dry-run]`.
 *
 * Signed delivery (ADR 003) builds every media URL from the object key. Rows
 * written before keys were stored only have the URL; for those the key is
 * recovered from the URL path at read time, and a row where that fails is
 * served as "unavailable". This writes the recovered key into the row, so
 * the read path no longer has to guess, and lists what cannot be recovered.
 *
 * Idempotent and batched: only rows with an empty key are touched, 500 at a
 * time, each batch in its own short statement. Run it before ImageKit is told
 * to refuse unsigned URLs (docs/operations/DEPLOYMENT.md, media rollout).
 */
const dryRun = process.argv.includes("--dry-run");
const BATCH = 500;
const KEY_PATTERN = /^(profiles|covers|posts|stories|messages)\/[^/]+\/./;

interface Target {
  label: string;
  table: "post_media" | "stories" | "messages" | "users";
  urlColumn: string;
  keyColumn: string;
}
const TARGETS: Target[] = [
  { label: "post media", table: "post_media", urlColumn: "url", keyColumn: "object_key" },
  { label: "stories", table: "stories", urlColumn: "media_url", keyColumn: "media_key" },
  { label: "message photos", table: "messages", urlColumn: "media_url", keyColumn: "media_key" },
  { label: "profile pictures", table: "users", urlColumn: "profile_picture_url", keyColumn: "profile_picture_key" },
  { label: "cover photos", table: "users", urlColumn: "cover_photo_url", keyColumn: "cover_photo_key" },
];

const backfill = async (target: Target): Promise<{ filled: number; unresolvable: string[] }> => {
  let after = "00000000-0000-0000-0000-000000000000";
  let filled = 0;
  const unresolvable: string[] = [];
  for (;;) {
    const { rows } = await sql<{ id: string; url: string }>`
      select id::text as id, ${sql.ref(target.urlColumn)} as url from ${sql.table(target.table)}
      where ${sql.ref(target.keyColumn)} = '' and ${sql.ref(target.urlColumn)} <> '' and id > ${after}::uuid
      order by id limit ${BATCH}`.execute(database);
    if (!rows.length) break;
    after = rows[rows.length - 1]!.id;
    const updates = rows.flatMap((row) => {
      const key = extractS3Key(row.url);
      if (key && KEY_PATTERN.test(key)) return [{ id: row.id, key }];
      unresolvable.push(row.id);
      return [];
    });
    if (updates.length && !dryRun) {
      await sql`
        update ${sql.table(target.table)} as t set ${sql.ref(target.keyColumn)} = v.key
        from (values ${sql.join(updates.map((update) => sql`(${update.id}::uuid, ${update.key})`))}) as v(id, key)
        where t.id = v.id and t.${sql.ref(target.keyColumn)} = ''`.execute(database);
    }
    filled += updates.length;
    if (rows.length < BATCH) break;
  }
  return { filled, unresolvable };
};

try {
  await connectDatabase();
  let unresolvableTotal = 0;
  for (const target of TARGETS) {
    const { filled, unresolvable } = await backfill(target);
    unresolvableTotal += unresolvable.length;
    console.log(`${target.label}: ${dryRun ? "would fill" : "filled"} ${filled} key(s); ${unresolvable.length} unresolvable`);
    // Row ids only - never the URLs, which are links to members' media.
    if (unresolvable.length) console.log(`  unresolvable ${target.table} ids: ${unresolvable.slice(0, 50).join(", ")}${unresolvable.length > 50 ? ", …" : ""}`);
  }
  if (unresolvableTotal) process.exitCode = 3;
} finally {
  await disconnectDatabase();
}
