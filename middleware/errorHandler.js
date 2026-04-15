import AppError from "../utils/AppError.js";

// ── 404 Handler ──────────────────────────────────────────────────────
export const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

// ── Global Error Handler ─────────────────────────────────────────────
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Mongoose Validation Error
  if (err.name === "ValidationError") {
    statusCode = 422;
    message = Object.values(err.errors).map((e) => e.message).join(", ");

  // Duplicate Key
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for field: "${field}"`;

  // Cast Error
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for field "${err.path}": ${err.value}`;

  // Payload too large
  } else if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "Request payload too large.";

  // Invalid JSON
  } else if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    statusCode = 400;
    message = "Invalid JSON in request body.";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};