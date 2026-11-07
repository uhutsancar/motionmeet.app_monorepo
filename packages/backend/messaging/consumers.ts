import { sql } from "kysely";
import { database, withTransaction, type DatabaseTransaction } from "../configs/database.js";
import { mediaMetadataResults } from "../observability/metrics.js";
import type { OutboxEventType } from "../db/types.js";
import sendEmail from "../configs/nodeMailer.js";
import { escapeHtml } from "../utils/html.js";
import { probeStoredImage, probeStoredVideo } from "../services/mediaProbeService.js";
import type { DomainEvent } from "./events.js";

/**
 * Something that reacts to domain events. Its `name` is durable: it names the
 * consumer's queue on the broker and its rows in `processed_events`, so
 * renaming a consumer re-applies every event it already handled.
 *
 * - `transactional` consumers only touch PostgreSQL. Their effect commits in
 *   the same transaction as the `processed_events` row, so a redelivered event
 *   is a no-op: exactly-once in effect, on top of at-least-once delivery.
 * - `external` consumers call something outside the database (SMTP). No
 *   transaction spans that call - holding one open across a network request
 *   would pin a pool connection for its whole duration - so the record is
 *   checked before and written after. A crash between the send and the write
 *   repeats the send on redelivery: at-least-once, stated in EVENT_CATALOG.md.
 */
export type EventConsumer =
  | { name: string; eventTypes: readonly OutboxEventType[]; kind: "transactional"; apply: (event: DomainEvent, transaction: DatabaseTransaction) => Promise<void> }
  | { name: string; eventTypes: readonly OutboxEventType[]; kind: "external"; perform: (event: DomainEvent) => Promise<void> };

/** An error retrying cannot fix; the event goes straight to the dead-letter queue. */
export class PermanentEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentEventError";
  }
}

const payloadString = (event: DomainEvent, key: string): string | null => {
  const value = event.payload[key];
  return typeof value === "string" ? value : null;
};

const PROJECTION_BATCH = 1_000;

/**
 * Copies an author's current name and picture onto their posts' `author_*`
 * columns. Reads no longer depend on it - `hydratePosts` reads the author
 * live - so this only keeps the stored copy (exports, ad-hoc queries) honest.
 *
 * It used to rewrite every one of the author's posts in one statement inside
 * one transaction: an avatar change by a member with thousands of posts wrote
 * thousands of row versions and held their locks, so likes and comments on
 * those posts queued behind it. Now only rows that differ are written, a
 * thousand per statement, each its own short transaction. It re-reads the user
 * rather than trusting the payload, so it is idempotent and two updates
 * applied out of order still end on the latest values - which is also why it
 * is safe as an `external` consumer (a redelivery repeats a no-op).
 */
const profileProjection: EventConsumer = {
  name: "profile-projection",
  eventTypes: ["user.profile.updated"],
  kind: "external",
  perform: async (event) => {
    for (;;) {
      const result = await sql`
        with author as (select full_name, username, profile_picture_url from users where id = ${event.aggregateId}),
        stale as (
          select p.id from posts p, author a
          where p.user_id = ${event.aggregateId}
            and (p.author_full_name, p.author_username, p.author_profile_picture) is distinct from (a.full_name, a.username, a.profile_picture_url)
          limit ${PROJECTION_BATCH}
        )
        update posts p set author_full_name = a.full_name, author_username = a.username, author_profile_picture = a.profile_picture_url
        from author a where p.id in (select id from stale)`.execute(database);
      if (Number(result.numAffectedRows ?? 0) < PROJECTION_BATCH) return;
    }
  },
};

/**
 * Emails the recipient of a connection request. With EMAIL_ENABLED=false the
 * event is consumed as a no-op - recorded as processed, so turning email on
 * later does not flush a backlog of stale requests into people's inboxes.
 */
const connectionRequestEmail: EventConsumer = {
  name: "connection-request-email",
  eventTypes: ["connection.requested"],
  kind: "external",
  perform: async (event) => {
    if (process.env.EMAIL_ENABLED === "false") return;
    const senderId = payloadString(event, "senderId");
    const recipientId = payloadString(event, "recipientId");
    if (!senderId || !recipientId) throw new PermanentEventError("connection.requested is missing its member ids");
    const [sender, recipient] = await Promise.all([
      database.selectFrom("users").select(["full_name", "username"]).where("id", "=", senderId).executeTakeFirst(),
      database.selectFrom("users").select(["email", "full_name"]).where("id", "=", recipientId).executeTakeFirst(),
    ]);
    // Either account may have been deleted since; there is nobody to tell.
    if (!sender || !recipient) return;
    await sendEmail({ to: recipient.email, subject: "New Connection Request", body: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>Hi ${escapeHtml(recipient.full_name)},</h2><p>You have a new connection request from ${escapeHtml(sender.full_name)} - @${escapeHtml(sender.username)}</p><p>Open <a href="${escapeHtml(process.env.FRONTEND_URL)}/connections">MotionMeet</a> to review it.</p><p>Thanks,<br/>MotionMeet</p></div>` });
  },
};

/**
 * Measures a new post's media and stores it on `post_media`: pixel size for
 * images, size and duration for videos (with ffprobe, which only the media
 * worker image carries; elsewhere videos are left as they are).
 *
 * The post went live when its upload was verified; this only adds metadata,
 * so a slow or failed probe never holds anything up. Each update writes only
 * a row still missing the value, which makes a repeated delivery a no-op, and
 * a post deleted in the meantime simply has no rows left to update.
 */
const mediaMetadata: EventConsumer = {
  name: "media-metadata",
  eventTypes: ["media.uploaded"],
  kind: "external",
  perform: async (event) => {
    const postId = payloadString(event, "postId");
    if (!postId) throw new PermanentEventError("media.uploaded is missing its post id");
    // Without object storage there is nothing to read.
    if (!process.env.AWS_BUCKET_NAME) return;
    const rows = await database.selectFrom("post_media").select(["id", "object_key", "media_type"])
      .where("post_id", "=", postId).where("object_key", "!=", "")
      .where((expression) => expression.or([
        expression.and([expression("media_type", "=", "image"), expression("width", "is", null)]),
        expression.and([expression("media_type", "=", "video"), expression("duration_seconds", "is", null)]),
      ]))
      .execute();
    for (const row of rows) {
      const kind = row.media_type;
      try {
        if (kind === "image") {
          const dimensions = await probeStoredImage(row.object_key);
          mediaMetadataResults.inc({ kind, result: dimensions ? "ok" : "permanent_failure" });
          if (dimensions) await database.updateTable("post_media").set(dimensions).where("id", "=", row.id).where("width", "is", null).execute();
          continue;
        }
        const video = await probeStoredVideo(row.object_key);
        mediaMetadataResults.inc({ kind, result: video ? "ok" : "permanent_failure" });
        if (video) await database.updateTable("post_media").set({ width: video.width, height: video.height, duration_seconds: String(video.durationSeconds) }).where("id", "=", row.id).where("duration_seconds", "is", null).execute();
      } catch (error: unknown) {
        // Storage, network, timeout or a missing ffprobe: not the file's
        // fault, so the event is retried rather than recorded as done.
        mediaMetadataResults.inc({ kind, result: "transient_failure" });
        throw error;
      }
    }
  },
};

export const EVENT_CONSUMERS: readonly EventConsumer[] = [profileProjection, connectionRequestEmail, mediaMetadata];

export const consumersFor = (eventType: OutboxEventType): EventConsumer[] =>
  EVENT_CONSUMERS.filter((consumer) => consumer.eventTypes.includes(eventType));

/**
 * Applies `event` through `consumer` unless this consumer already has. The one
 * idempotency rule, used by the broker consumer and the direct dispatcher
 * alike, so switching transports cannot apply an event twice.
 */
export const applyEventOnce = async (consumer: EventConsumer, event: DomainEvent): Promise<"applied" | "duplicate"> => {
  if (consumer.kind === "transactional") {
    return withTransaction(async (transaction) => {
      // The insert takes the row lock first, so a concurrent duplicate waits
      // here and then finds the row instead of applying the effect twice.
      const claimed = await transaction.insertInto("processed_events").values({ consumer: consumer.name, event_id: event.eventId })
        .onConflict((conflict) => conflict.columns(["consumer", "event_id"]).doNothing()).returning("event_id").executeTakeFirst();
      if (!claimed) return "duplicate";
      await consumer.apply(event, transaction);
      return "applied";
    });
  }
  const seen = await database.selectFrom("processed_events").select("event_id").where("consumer", "=", consumer.name).where("event_id", "=", event.eventId).executeTakeFirst();
  if (seen) return "duplicate";
  await consumer.perform(event);
  await database.insertInto("processed_events").values({ consumer: consumer.name, event_id: event.eventId })
    .onConflict((conflict) => conflict.columns(["consumer", "event_id"]).doNothing()).execute();
  return "applied";
};
