import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export const requestContext = (req, res, next) => {
  const supplied = req.get("x-request-id");
  const requestId =
    typeof supplied === "string" && REQUEST_ID_PATTERN.test(supplied)
      ? supplied
      : randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.once("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info("request_completed", {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
};
