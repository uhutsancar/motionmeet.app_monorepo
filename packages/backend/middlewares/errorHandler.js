import multer from "multer";
import { logger } from "../utils/logger.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let status = Number.isInteger(error.status) ? error.status : 500;
  let message = status >= 500 ? "Internal server error" : error.message;

  if (error instanceof multer.MulterError) {
    status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message = error.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : "Invalid file upload";
  } else if (error?.code === 11000) {
    status = 409;
    message = "A record with these values already exists";
  } else if (error.name === "ValidationError" || error.name === "CastError" || error instanceof SyntaxError) {
    status = 400;
    message = "Invalid request data";
  }

  if (status >= 500) {
    logger.error("unhandled_request_error", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      errorName: error.name,
      errorMessage: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
  }

  const codeByStatus = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    429: "RATE_LIMITED",
    503: "SERVICE_UNAVAILABLE",
  };
  const errorResponse = {
    code: codeByStatus[status] || "INTERNAL_SERVER_ERROR",
    message
  };

  if (error.fieldErrors) {
    errorResponse.fields = error.fieldErrors;
  }

  return res.status(status).json({
    success: false,
    message,
    error: errorResponse,
    requestId: req.requestId,
  });
};
