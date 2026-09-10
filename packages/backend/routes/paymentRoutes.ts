import express from "express";
import { protect, attachDbUser } from "../middlewares/auth.js";
import { createMyPortalSession, getMyCheckoutIntent, getMySubscriptionSummary } from "../controllers/paymentController.js";

const router = express.Router();

router.get("/checkout-intent", protect, attachDbUser, getMyCheckoutIntent);
router.get("/subscription", protect, attachDbUser, getMySubscriptionSummary);
router.post("/portal-session", protect, attachDbUser, createMyPortalSession);

export default router;
