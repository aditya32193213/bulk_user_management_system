// src/server.js
import app from "./app.js";
import connectDB from "./config/db.js";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

/*
 * FIX (Issue 2): Added .catch() so that any unexpected error thrown by
 * connectDB() or app.listen() results in a clean fatal log + exit rather
 * than a silent unhandled promise rejection that Node would otherwise emit.
 */
startServer().catch((err) => {
  console.error("Fatal startup error:", err.message);
  process.exit(1);
});