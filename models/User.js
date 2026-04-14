// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // ── Core Identity Fields ──────────────────────────────
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [3, "Full name must be at least 3 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      match: [/^\d{10,15}$/, "Phone number must be 10–15 digits"],
    },

    // ── Financial Fields ──────────────────────────────────
    walletBalance: {
      type: Number,
      default: 0,
      min: [0, "Wallet balance cannot be negative"],
    },

    // ── Account Status Fields ─────────────────────────────
    isBlocked: {
      type: Boolean,
      default: false,
    },

    kycStatus: {
      type: String,
      enum: {
        values: ["Pending", "Approved", "Rejected"],
        message: "kycStatus must be Pending, Approved, or Rejected",
      },
      default: "Pending",
    },

    // ── Device & Tracking Information ─────────────────────
    deviceInfo: {
      ipAddress: {
        type: String,
      },
      // FIX (Issue 6): Added object-style enum with custom message to match
      // kycStatus style and produce meaningful Mongoose validation errors.
      deviceType: {
        type: String,
        enum: {
          values: ["Mobile", "Desktop"],
          message: "deviceType must be Mobile or Desktop",
        },
      },
      os: {
        type: String,
        enum: {
          values: ["Android", "iOS", "Windows", "macOS"],
          message: "os must be Android, iOS, Windows, or macOS",
        },
      },
    },
  },

  {
    // ── System Managed Fields (auto-handled by Mongoose) ──
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ── Indexes ───────────────────────────────────────────────
// email and phone already have unique: true which creates indexes.
// Compound index for common admin query pattern: filter by kycStatus + isBlocked.
userSchema.index({ kycStatus: 1, isBlocked: 1 });

const User = mongoose.model("User", userSchema);
export default User;