// app.js

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";                   
import rateLimit from "express-rate-limit";    
import userRoutes from "./routes/userRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());
app.use(cors());

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));


app.get("/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime() })
);

// FIX (Issue 5): 30 requests / minute per IP across all /api/* routes.
// Returns a clean JSON 429 instead of a process-level crash under flood.
app.use(
  "/api/",
  rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,   // adds RateLimit-* headers (RFC 6585)
    legacyHeaders: false,     // disables X-RateLimit-* (deprecated)
    message: { message: "Too many requests. Please try again in a minute." },
  })
);

app.use(express.json({ limit: "50mb" }));

// ── Routes ───────────────────────────────────────────────────────────
app.use("/api/users", userRoutes);

// ── Error Handling ───────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;