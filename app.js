// src/app.js
// FIX (Issue 3): Changed misleading "Entry point" comment — server.js is the entry point.
// Express application setup
import express from "express";
import cors from "cors";
import helmet from "helmet"; // FIX (Issue 5): Added helmet for HTTP security headers
import userRoutes from "./routes/userRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());

app.use(cors());


app.use(express.json({ limit: "50mb" }));

// ── Routes ───────────────────────────────────────────────────────────
app.use("/api/users", userRoutes);

// ── Error Handling ───────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;