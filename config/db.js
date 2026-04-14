// config/db.js
import mongoose from "mongoose";

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