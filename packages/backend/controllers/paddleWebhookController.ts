import type { RequestHandler } from "express";
import { getPaddleClient } from "../configs/paddle.js";
import { loadEnvironment } from "../configs/environment.js";
import { processWebhookEvent } from "../services/webhookEventService.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

/**
 * Paddle notification endpoint. Mounted in server.ts with its own
 * `express.raw()` parser, *before* the app-wide `express.json()` - signature
 * verification needs the exact bytes Paddle sent, and once `express.json()`
 * has parsed and re-serialized a body it is no longer byte-identical to what
 * was signed. See docs/paddle-integration-plan.md §7.1.
 *
 * No `protect`/CSRF middleware here on purpose: this is a server-to-server
 * call with no MotionMeet session, authenticated entirely by the signature.
 */
export const handlePaddleWebhook: RequestHandler = async (req, res) => {
  const environment = loadEnvironment();
  const client = getPaddleClient();
  if (!client || !environment.paddleWebhookSecret || !environment.paddleEnvironment) {
    return void res.status(503).json({ success: false, message: "Payments are not configured" });
  }

  const signature = req.headers["paddle-signature"];
  const rawBody = req.body;
  if (typeof signature !== "string" || !Buffer.isBuffer(rawBody)) {
    return void res.status(400).json({ success: false, message: "Invalid webhook request" });
  }
  const rawBodyText = rawBody.toString("utf8");

  let event;
  try {
    event = await client.webhooks.unmarshal(rawBodyText, environment.paddleWebhookSecret, signature);
  } catch (error) {
    // Wrong secret, tampered body, or a timestamp outside Paddle's tolerance
    // window all land here. Nothing is written to the database on this path.
    logger.warn("paddle_webhook_signature_invalid", safeErrorMetadata(error));
    return void res.status(401).json({ success: false, message: "Invalid signature" });
  }
  if (!event) {
    return void res.status(400).json({ success: false, message: "Unrecognized event" });
  }

  // Stored for audit exactly as Paddle sent it, not the SDK's camelCased
  // entity - see webhookEventService.
  let rawPayload: unknown = null;
  try {
    rawPayload = JSON.parse(rawBodyText);
  } catch {
    // Signature already verified against these exact bytes, so this can't
    // actually happen; falling back to null rather than failing the request
    // over an audit-log nicety.
  }

  try {
    await processWebhookEvent(event, rawPayload, environment.paddleEnvironment);
    res.status(200).json({ success: true });
  } catch (error) {
    // Transient failure - respond 5xx so Paddle's own retry schedule tries
    // again rather than treating this delivery as permanently rejected.
    logger.error("paddle_webhook_handler_failed", { eventId: event.eventId, ...safeErrorMetadata(error) });
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};
