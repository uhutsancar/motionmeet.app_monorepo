import express from "express";
import { handlePaddleWebhook } from "../controllers/paddleWebhookController.js";

const router = express.Router();

router.post("/", handlePaddleWebhook);

export default router;
