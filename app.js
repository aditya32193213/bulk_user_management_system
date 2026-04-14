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
app.use(express.json({ limit: "50mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime() })
);

app.use(
  "/api/",
  rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again in a minute." },
  })
);

app.use("/api/users", userRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;