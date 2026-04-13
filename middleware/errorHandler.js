// src/middleware/errorHandler.js

// ── 404 Handler ──────────────────────────────────────────────────────
export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404);
  next(error); // pass to error handler below
};


// ── Global Error Handler ─────────────────────────────────────────────
// Must have 4 parameters — Express identifies it as an error handler this way
export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Mongoose Validation Error (schema-level, e.g. minlength failed)
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({
      message: "Mongoose validation error.",
      errors: messages,
    });
  }

  // Mongoose Duplicate Key Error (unique index violation)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({
      message: `Duplicate value for field: "${field}".`,
      field,
      value: err.keyValue?.[field],
    });
  }

  // Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      message: `Invalid value for field "${err.path}": ${err.value}`,
    });
  }

  // Payload Too Large (express.json limit exceeded)
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request payload too large. Reduce batch size.",
    });
  }

  // SyntaxError (malformed JSON in request body)
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      message: "Invalid JSON in request body.",
    });
  }

  // Fallback
  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};