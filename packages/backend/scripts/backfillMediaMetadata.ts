import "dotenv/config";
import { sql } from "kysely";
import { connectDatabase, database, disconnectDatabase, withTransaction } from "../configs/database.js";
import { enqueueOutboxEvent } from "../services/outboxService.js";

/**
 * Re-queues media metadata for posts still missing it:
 * `backfill:media-metadata [--dry-run]`.
 *
 * Until the 2026-11 audit (WP-10) a failed probe - storage hiccup, network,
 * no ffprobe in the worker image - was recorded as done, so some images have
 * no size and some videos no duration. This writes one `media.uploaded` event
 * per affected post. The media worker fills only what is still missing, so a
 * post that meanwhile got its metadata, or is queued twice, is a no-op.
 *
 * Batched by post id, each batch in its own transaction.
 */
const dryRun = process.argv.includes("--dry-run");
const BATCH = 500;

try {
  await connectDatabase();
  let after = "00000000-0000-0000-0000-000000000000";
  let queued = 0;
  for (;;) {
    const { rows } = await sql<{ post_id: string }>`
      select distinct post_id::text as post_id from post_media
      where object_key <> ''
        and ((media_type = 'image' and width is null) or (media_type = 'video' and duration_seconds is null))
        and post_id > ${after}::uuid
      order by post_id limit ${BATCH}`.execute(database);
    if (!rows.length) break;
    after = rows[rows.length - 1]!.post_id;
    if (!dryRun) {
      await withTransaction(async (transaction) => {
        for (const row of rows) await enqueueOutboxEvent(transaction, { type: "media.uploaded", aggregateId: row.post_id, payload: { postId: row.post_id } });
      });
    }
    queued += rows.length;
    if (rows.length < BATCH) break;
  }
  console.log(`${dryRun ? "Would queue" : "Queued"} media metadata for ${queued} post(s).`);
} finally {
  await disconnectDatabase();
}
