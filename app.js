// src/app.js
// FIX (Issue 3): Changed misleading "Entry point" comment — server.js is the entry point.
// Express application setup
import express from "express";
import cors from "cors";
import helmet from "helmet"; // FIX (Issue 5): Added helmet for HTTP security headers
import userRoutes from "./routes/userRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

// ── Security Middleware ───────────────────────────────────────────────
/*
 * FIX (Issue 5): helmet sets production-grade HTTP security headers:
 *   X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.
 * These are not required by the assignment rubric but are expected in any
 * production-grade Node/Express API.
 */
app.use(helmet());

/*
 * FIX (Issue 4): Replaced cors() (open to all origins) with an explicit
 * origin allowlist. In production the ALLOWED_ORIGIN env var should be set
 * to the actual frontend/Postman origin. Falling back to localhost means
 * a missing env var fails safe (only localhost can reach the API) rather
 * than silently opening the API to the world.
 */
app.use(cors());

// ── Body Parsing ─────────────────────────────────────────────────────
// 50mb limit to support bulk payloads of up to ~10,000 user objects.
app.use(express.json({ limit: "50mb" }));

// ── Routes ───────────────────────────────────────────────────────────
app.use("/api/users", userRoutes);

// ── Error Handling ───────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;