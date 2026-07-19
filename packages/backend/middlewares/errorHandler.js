import multer from "multer";

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
    status = 400;
    message = error.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : "Invalid file upload";
  } else if (error.name === "ValidationError" || error.name === "CastError" || error instanceof SyntaxError) {
    status = 400;
    message = "Invalid request data";
  }

  if (status >= 500) {
    console.error("Unhandled request error:", error);
  }

  const errorResponse = {
    code: status === 400 ? "BAD_REQUEST" : status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
    message
  };

  if (error.fieldErrors) {
    errorResponse.fields = error.fieldErrors;
  }

  return res.status(status).json({ success: false, error: errorResponse });
};

