import { createUploadReservation } from "../services/mediaUploadService.js";
import type { RequestHandler } from "express";
import { consumeDistributedLimit } from "../configs/redis.js";

export const presignMediaUpload: RequestHandler = async (req, res, next) => {
  try {
    if (
      !(await consumeDistributedLimit(
        `media-presign:${req.userId}`,
        30,
        60 * 60
      ))
    ) {
      return res.status(429).json({
        success: false,
        message: "Hourly upload authorization limit reached",
      });
    }
    const reservation = await createUploadReservation({
      userId: req.userId,
      purpose: req.body?.purpose,
      fileName: req.body?.fileName,
      contentType: req.body?.contentType,
      size: req.body?.size,
    });
    if (!reservation) {
      return res.status(400).json({
        success: false,
        message: "Invalid media upload request",
      });
    }
    return res.status(201).json({ success: true, ...reservation });
  } catch (error) {
    return next(error);
  }
};
