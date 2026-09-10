import type { RequestHandler } from "express";
import { isUuid } from "../utils/validation.js";
import { findUserById } from "../repositories/userRepository.js";
import { createPortalSessionUrl, getCheckoutIntent } from "../services/paddleService.js";

const isBillingInterval = (value: unknown): value is "monthly" | "yearly" => value === "monthly" || value === "yearly";

export const getMyCheckoutIntent: RequestHandler = async (req, res, next) => {
  try {
    const planId = req.query.planId;
    const interval = req.query.interval;
    if (!isUuid(planId) || !isBillingInterval(interval)) {
      return res.status(400).json({ success: false, message: "Invalid planId or interval" });
    }
    const intent = await getCheckoutIntent(req.userId, planId, interval);
    if (!intent) {
      return res.status(404).json({ success: false, message: "This plan is not available for checkout right now" });
    }
    res.status(200).json({ success: true, ...intent });
  } catch (error) {
    next(error);
  }
};

export const getMySubscriptionSummary: RequestHandler = async (req, res, next) => {
  try {
    const user = req.dbUser;
    if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
    res.status(200).json({
      success: true,
      subscription: {
        planStatus: user.planStatus,
        plan: user.plan,
        planStartDate: user.planStartDate,
        planEndDate: user.planEndDate,
        planCancelledAt: user.planCancelledAt,
        planCancelAtPeriodEnd: user.planCancelAtPeriodEnd,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createMyPortalSession: RequestHandler = async (req, res, next) => {
  try {
    // `attachDbUser` deliberately doesn't request sensitive fields (it would
    // otherwise leak the password hash to every handler that mounts it), so
    // the Paddle customer id needs its own targeted, sensitive-scoped lookup.
    const user = await findUserById(req.userId, { plan: false, sensitive: true });
    if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
    const paddleCustomerId = user.paddleCustomerId;
    if (!paddleCustomerId) {
      return res.status(404).json({ success: false, message: "No billing account on file" });
    }
    const paddleSubscriptionId = user.paddleSubscriptionId ?? "";
    const url = await createPortalSessionUrl(paddleCustomerId, paddleSubscriptionId);
    if (!url) return res.status(503).json({ success: false, message: "Billing portal is unavailable" });
    res.status(200).json({ success: true, url });
  } catch (error) {
    next(error);
  }
};
