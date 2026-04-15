// server.js
import "dotenv/config"; // ← static import, hoisted before all other modules evaluate
import app from "./app.js";
import connectDB from "./config/db.js";
import mongoose from "mongoose";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  const server = app.listen(PORT, () => {         // ← capture reference
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
};

startServer().catch((err) => {
  console.error("Fatal startup error:", err.message);
  process.exit(1);
});