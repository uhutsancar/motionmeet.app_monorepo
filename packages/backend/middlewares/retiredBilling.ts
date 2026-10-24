import type { RequestHandler } from "express";

/** The paid-plan API MotionMeet used to expose. */
export const RETIRED_BILLING_PATHS = ["/api/plans", "/api/payments"];

/**
 * MotionMeet no longer sells plans. Old clients and the provider's webhook
 * retries get an explicit 410 instead of a generic 404, whatever the method,
 * sub-path or body.
 */
export const answerRetiredBilling: RequestHandler = (_request, response) => {
  response.status(410).json({ success: false, message: "Plans and payments are no longer offered" });
};
