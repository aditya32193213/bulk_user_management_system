// server.js
import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import mongoose from "mongoose";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Closing server...`);
    server.close(async () => {
      await mongoose.connection.close();
      console.log("DB connection closed. Exiting.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
    gracefulShutdown("unhandledRejection");
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err.message);
    gracefulShutdown("uncaughtException");
  });
};

startServer().catch((err) => {
  console.error("Fatal startup error:", err.message);
  process.exit(1);
});