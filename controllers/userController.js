// controllers/userController.js
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Flatten nested object into dot notation for MongoDB updates.
 * Prevents accidental full-object overwrite on nested fields like deviceInfo.
 */
const flattenFields = (obj, prefix = "") => {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    // Prevent prototype pollution
    if (["__proto__", "constructor", "prototype"].includes(key)) continue;

    const newKey = prefix ? `${prefix}.${key}` : key;

    const isObject =
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date);

    if (isObject) {
      Object.assign(result, flattenFields(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
};

// ── POST /api/users/bulk-create ──────────────────────────────────────
export const bulkCreateUsers = asyncHandler(async (req, res, next) => {
  const users = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    throw new AppError("Request body must be a non-empty array.", 400);
  }

  try {
    const result = await User.insertMany(users, {
      ordered: false,
      includeResultMetadata: true,
    });

    return res.status(201).json({
      success: true,
      message: "Bulk create completed.",
      inserted: result.insertedCount,
      total: users.length,
    });
  } catch (err) {
    if (err.name === "MongoBulkWriteError") {
      const inserted = err.result?.insertedCount ?? 0;
      const failed = users.length - inserted;

      return res.status(207).json({
        success: true,
        message: "Bulk create partially completed.",
        inserted,
        failed,
        total: users.length,
        duplicates: (err.writeErrors || []).map((e) => ({
          index: e.index,
          message: e.errmsg,
        })),
      });
    }

    return next(err);
  }
});

// ── PUT /api/users/bulk-update ───────────────────────────────────────
export const bulkUpdateUsers = asyncHandler(async (req, res, next) => {
  const updates = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    throw new AppError("Request body must be a non-empty array.", 400);
  }

  // FIX: Added null-safe fallback on email before calling toLowerCase().
  // In practice this is unreachable (validator guarantees email is present),
  // but defensive programming prevents a silent TypeError crash if somehow
  // the controller is called without the validator middleware.
  const emailList = updates.filter((u) => typeof u.email === "string" && u.email.length > 0).map((u) => u.email.toLowerCase());

  try {
    const foundDocs = await User.find(
      { email: { $in: emailList } },
      { email: 1, _id: 0 }
    ).lean();

    const matchedEmailSet = new Set(foundDocs.map((d) => d.email));
    const notFoundEmails = emailList.filter((e) => !matchedEmailSet.has(e));

    const operations = updates.map((update) => {
      const {
        email,
        _id,
        __v,
        createdAt,
        updatedAt,
        ...fields
      } = update;

      return {
        updateOne: {
          filter: { email: email.toLowerCase() },
          update: {
            $set: {
              ...flattenFields(fields),
              updatedAt: new Date(),
            },
          },
        },
      };
    });

    const result = await User.bulkWrite(operations, { ordered: false });

    if (notFoundEmails.length > 0) {
      return res.status(207).json({
        success: true,
        message: "Bulk update partially completed. Some emails were not found.",
        matched: result.matchedCount,
        modified: result.modifiedCount,
        notFound: notFoundEmails.length,
        notFoundEmails,
        total: updates.length,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bulk update completed.",
      matched: result.matchedCount,
      modified: result.modifiedCount,
      total: updates.length,
    });
  } catch (err) {
    if (err.name === "MongoBulkWriteError") {
      return res.status(207).json({
        success: true,
        message: "Partial update.",
        errors: (err.writeErrors || []).map((e) => ({
          index: e.index,
          message: e.errmsg,
        })),
      });
    }

    return next(err);
  }
});