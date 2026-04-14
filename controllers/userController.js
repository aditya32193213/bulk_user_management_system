// controllers/userController.js
import User from "../models/User.js";

// ── POST /api/users/bulk-create ──────────────────────────────────────
export const bulkCreateUsers = async (req, res) => {
  const users = req.body;

  // validateBulkCreate middleware already guards this, but kept as a
  // defensive fallback in case the route is ever called without the middleware.
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
    /*
     * Catch ALL MongoBulkWriteErrors (not just code 11000).
     * A bulk write can fail for duplicate keys, write concern errors,
     * or DB-level validation failures — all surface as MongoBulkWriteError.
     */
    if (err.name === "MongoBulkWriteError") {
      const inserted = err.result?.insertedCount ?? 0;
      const failed = users.length - inserted;

      const duplicates =
        err.code === 11000
          ? err.writeErrors?.map((e) => ({
              index: e.index,
              message: e.errmsg?.match(/dup key: \{(.+?)\}/)?.[1] ?? "Duplicate key",
            }))
          : undefined;

      return res.status(207).json({
        message: "Bulk create partially completed.",
        inserted,
        failed,
        ...(duplicates && { duplicates }),
        ...(err.code !== 11000 && { error: err.message }),
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
   *
   * Prototype pollution guard: keys like __proto__ or constructor are
   * skipped to prevent object prototype manipulation via crafted payloads.
   */
  const flattenFields = (obj, prefix = "") => {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      // Guard against prototype pollution
      if (
        fullKey.includes("__proto__") ||
        fullKey.includes("constructor") ||
        fullKey.includes("prototype")
      ) {
        return acc;
      }

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

  /*
   * FIX (Issue 8): email.toLowerCase() added to the filter.
   * The Mongoose schema stores email in lowercase (lowercase: true).
   * If the caller sends a mixed-case email like "ADITYA@GMAIL.COM",
   * the filter { email: "ADITYA@GMAIL.COM" } would match nothing
   * because the stored value is "aditya@gmail.com".
   * Normalising here guarantees the filter always matches the stored value.
   *
   * Note: bulkWrite sends operations directly to the MongoDB driver,
   * bypassing Mongoose middleware and schema validators. This is why
   * the pre-DB validator (userValidators.js) must be airtight — there
   * is no Mongoose safety net here.
   */
  const operations = updates.map(({ email, ...fields }) => ({
    updateOne: {
      filter: { email: email.toLowerCase() }, // FIX: normalise to lowercase
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
     * bulkWrite does NOT throw for unmatched documents — it silently skips
     * them. We detect and surface this here with 207 (Multi-Status).
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
        matched: err.result?.matchedCount ?? 0,
        modified: err.result?.modifiedCount ?? 0,
        errors: err.writeErrors?.map((e) => ({
          index: e.index,
          message: e.errmsg,
        })),
      });
    }

    return res.status(500).json({ message: "Server error.", error: err.message });
  }
};