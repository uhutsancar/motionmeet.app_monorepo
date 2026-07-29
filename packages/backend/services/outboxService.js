import crypto from "node:crypto";
import OutboxEvent from "../models/OutboxEvent.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import sendEmail from "../configs/nodeMailer.js";
import { escapeHtml } from "../utils/html.js";

const claimNextEvent = async () => {
  const now = new Date();
  const claimToken = crypto.randomUUID();
  const claimUntil = new Date(now.getTime() + 60_000);
  const event = await OutboxEvent.findOneAndUpdate(
    {
      nextAttemptAt: { $lte: now },
      $or: [
        { status: "pending" },
        { status: "processing", claimUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "processing",
        claimToken,
        claimUntil,
      },
    },
    { new: true, sort: { nextAttemptAt: 1, _id: 1 } }
  );
  return event ? { event, claimToken } : null;
};

const applyEvent = async (event) => {
  if (event.type === "user.profile.updated") {
    const user = await User.findById(event.aggregateId)
      .select("full_name username profile_picture")
      .lean();
    if (!user) return;
    await Post.updateMany(
      { user: event.aggregateId },
      {
        $set: {
          "author_profile.full_name": user.full_name,
          "author_profile.username": user.username,
          "author_profile.profile_picture": user.profile_picture || "",
        },
      }
    );
    return;
  }
  if (event.type === "connection.requested") {
    if (process.env.EMAIL_ENABLED === "false") return;
    const [sender, recipient] = await Promise.all([
      User.findById(event.payload.senderId)
        .select("full_name username")
        .lean(),
      User.findById(event.payload.recipientId)
        .select("email full_name")
        .lean(),
    ]);
    if (!sender || !recipient) return;
    await sendEmail({
      to: recipient.email,
      subject: "New Connection Request",
      body: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hi ${escapeHtml(recipient.full_name)},</h2>
          <p>You have a new connection request from ${escapeHtml(sender.full_name)} - @${escapeHtml(sender.username)}</p>
          <p>Open <a href="${process.env.FRONTEND_URL}/connections">MotionMeet</a> to review it.</p>
          <p>Thanks,<br/>MotionMeet</p>
        </div>`,
    });
    return;
  }
  throw new Error(`Unsupported outbox event type: ${event.type}`);
};

export const processOutboxEvents = async ({ limit = 200 } = {}) => {
  let processed = 0;
  while (processed < limit) {
    const claim = await claimNextEvent();
    if (!claim) break;
    const { event, claimToken } = claim;
    try {
      await applyEvent(event);
      await OutboxEvent.deleteOne({ _id: event._id, claimToken });
    } catch (error) {
      const attempts = event.attempts + 1;
      const retryDelay = Math.min(
        24 * 60 * 60 * 1000,
        2 ** attempts * 30_000
      );
      await OutboxEvent.updateOne(
        { _id: event._id, claimToken },
        {
          $set: {
            status: "pending",
            claimToken: null,
            claimUntil: null,
            nextAttemptAt: new Date(Date.now() + retryDelay),
            lastError: String(error?.message || "Outbox processing failed").slice(
              0,
              500
            ),
          },
          $inc: { attempts: 1 },
        }
      );
    }
    processed += 1;
  }
  return processed;
};
