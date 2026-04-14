// config/db.js
import mongoose from "mongoose";

// Register once at module level — safe regardless of how many times connectDB runs
mongoose.connection.on("error", (err) => {
  console.error("MongoDB runtime error:", err.message);
});
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected. Reconnecting...");
});
mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconnected.");
});

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error("FATAL: MONGO_URI is not defined in environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  }
};

export default connectDB;