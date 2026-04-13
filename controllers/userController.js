// src/controllers/userController.js
import User from "../models/User.js";

// ── POST /api/users/bulk-create ──────────────────────────────────────
export const bulkCreateUsers = async (req, res) => {
  const users = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: "Request body must be a non-empty array." });
  }

  try {
    /*
     * ordered: false  → continues inserting even if some records fail
     * includeResultMetadata: true → returns raw MongoDB result object
     * rawResult was deprecated in Mongoose 8, removed in 9
     */
    const result = await User.insertMany(users, {
      ordered: false,
      includeResultMetadata: true,
    });

    return res.status(201).json({
      message: "Bulk create completed.",
      inserted: result.insertedCount,
      total: users.length,
    });
  } catch (err) {
    if (err.name === "MongoBulkWriteError" && err.code === 11000) {
      const inserted = err.result?.nInserted ?? 0;
      const failed = users.length - inserted;

      const duplicates = err.writeErrors?.map((e) => ({
        index: e.index,
        message: e.errmsg?.match(/dup key: \{(.+?)\}/)?.[0] ?? "Duplicate key",
      }));

      return res.status(207).json({
        message: "Bulk create partially completed.",
        inserted,
        failed,
        duplicates,
      });
    }

    return res.status(500).json({ message: "Server error.", error: err.message });
  }
};


// ── PUT /api/users/bulk-update ───────────────────────────────────────
export const bulkUpdateUsers = async (req, res) => {
  const updates = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ message: "Request body must be a non-empty array." });
  }

  /*
   * flattenFields: converts nested objects to dot-notation keys so that
   * $set performs a PARTIAL subdocument update rather than replacing the
   * whole object.
   *
   * Example:  { deviceInfo: { os: "iOS" } }
   *    becomes { "deviceInfo.os": "iOS" }
   *
   * Without this, sending only deviceInfo.os would silently wipe out
   * deviceInfo.ipAddress and deviceInfo.deviceType on every update.
   */
  const flattenFields = (obj, prefix = "") => {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        Object.assign(acc, flattenFields(value, fullKey));
      } else {
        acc[fullKey] = value;
      }
      return acc;
    }, {});
  };

  const operations = updates.map(({ email, ...fields }) => ({
    updateOne: {
      filter: { email },
      update: {
        $set: {
          ...flattenFields(fields),
          updatedAt: new Date(),
        },
      },
    },
  }));

  try {
    const result = await User.bulkWrite(operations, { ordered: false });

    const matched = result.matchedCount;
    const modified = result.modifiedCount;
    const notFound = updates.length - matched;

    /*
     * bulkWrite does NOT throw an error for unmatched documents — it silently
     * skips them. We detect this here and return 207 (Multi-Status) so the
     * caller knows the operation was only partially successful.
     */
    if (notFound > 0) {
      return res.status(207).json({
        message: "Bulk update partially completed. Some emails were not found.",
        matched,
        modified,
        notFound,
        total: updates.length,
      });
    }

    return res.status(200).json({
      message: "Bulk update completed.",
      matched,
      modified,
      total: updates.length,
    });
  } catch (err) {
    if (err.name === "MongoBulkWriteError") {
      return res.status(207).json({
        message: "Bulk update partially completed.",
        matched: err.result?.nMatched ?? 0,
        modified: err.result?.nModified ?? 0,
        errors: err.writeErrors?.map((e) => ({
          index: e.index,
          message: e.errmsg,
        })),
      });
    }

    return res.status(500).json({ message: "Server error.", error: err.message });
  }
};