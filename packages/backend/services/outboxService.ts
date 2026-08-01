import crypto from "node:crypto";
import { database, withTransaction } from "../configs/database.js";
import type { Row } from "../db/types.js";
import sendEmail from "../configs/nodeMailer.js";
import { escapeHtml } from "../utils/html.js";

const claimNextEvent = async (): Promise<Row<"outbox_events"> | null> => withTransaction(async (transaction) => {
  const now = new Date();
  const event = await transaction.selectFrom("outbox_events").selectAll().where("next_attempt_at", "<=", now)
    .where((expression) => expression.or([expression("status", "=", "pending"), expression.and([expression("status", "=", "processing"), expression("claim_until", "<=", now)])]))
    .orderBy("next_attempt_at").orderBy("id").forUpdate().skipLocked().executeTakeFirst();
  if (!event) return null;
  return await transaction.updateTable("outbox_events").set({ status: "processing", claim_token: crypto.randomUUID(), claim_until: new Date(now.getTime() + 60_000) }).where("id", "=", event.id).returningAll().executeTakeFirst() ?? null;
});

const payloadString = (payload: Record<string, string | number | boolean | null>, key: string): string | null => typeof payload[key] === "string" ? payload[key] as string : null;

const applyEvent = async (event: Row<"outbox_events">): Promise<void> => {
  if (event.type === "user.profile.updated") {
    const user = await database.selectFrom("users").select(["full_name", "username", "profile_picture_url"]).where("id", "=", event.aggregate_id).executeTakeFirst();
    if (!user) return;
    await database.updateTable("posts").set({ author_full_name: user.full_name, author_username: user.username, author_profile_picture: user.profile_picture_url }).where("user_id", "=", event.aggregate_id).execute();
    return;
  }
  if (event.type === "connection.requested") {
    if (process.env.EMAIL_ENABLED === "false") return;
    const senderId = payloadString(event.payload, "senderId"); const recipientId = payloadString(event.payload, "recipientId"); if (!senderId || !recipientId) return;
    const [sender, recipient] = await Promise.all([
      database.selectFrom("users").select(["full_name", "username"]).where("id", "=", senderId).executeTakeFirst(),
      database.selectFrom("users").select(["email", "full_name"]).where("id", "=", recipientId).executeTakeFirst(),
    ]);
    if (!sender || !recipient) return;
    await sendEmail({ to: recipient.email, subject: "New Connection Request", body: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>Hi ${escapeHtml(recipient.full_name)},</h2><p>You have a new connection request from ${escapeHtml(sender.full_name)} - @${escapeHtml(sender.username)}</p><p>Open <a href="${escapeHtml(process.env.FRONTEND_URL)}/connections">MotionMeet</a> to review it.</p><p>Thanks,<br/>MotionMeet</p></div>` });
    return;
  }
  throw new Error(`Unsupported outbox event type: ${event.type}`);
};

export const processOutboxEvents = async ({ limit = 200 }: { limit?: number } = {}): Promise<number> => {
  let processed = 0;
  while (processed < limit) {
    const event = await claimNextEvent(); if (!event) break;
    try { await applyEvent(event); await database.deleteFrom("outbox_events").where("id", "=", event.id).where("claim_token", "=", event.claim_token).execute(); }
    catch (error: unknown) {
      const attempts = event.attempts + 1; const message = error instanceof Error ? error.message : "Outbox processing failed";
      await database.updateTable("outbox_events").set({ status: "pending", attempts, claim_token: null, claim_until: null, next_attempt_at: new Date(Date.now() + Math.min(86_400_000, 2 ** attempts * 30_000)), last_error: message.slice(0, 500) }).where("id", "=", event.id).where("claim_token", "=", event.claim_token).execute();
    }
    processed += 1;
  }
  return processed;
};
