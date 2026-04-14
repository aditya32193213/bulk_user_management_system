// controllers/userController.js
import User from "../models/User.js";

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
   * FIX (Issue 10): Pre-flight DB lookup to identify unmatched emails.
   * bulkWrite does NOT throw for unmatched documents — it silently skips
   * them, so the only way to know which specific emails were not found is to
   * diff the requested list against what actually exists in the DB.
   * We do a single lean() query (projection: email only) before the write so
   * the notFoundEmails list is available for the 207 response body.
   * This adds one round-trip but eliminates the opaque "notFound: 3" message
   * that gave callers no actionable information about which records failed.
   */
  const emailList = updates.map((u) => u.email);
  const foundDocs = await User.find(
    { email: { $in: emailList } },
    { email: 1, _id: 0 }
  ).lean();
  const matchedEmailSet = new Set(foundDocs.map((d) => d.email));
  const notFoundEmails = emailList.filter((e) => !matchedEmailSet.has(e));

  /*
   * FIX (Issue 2): Destructure _id, __v, and createdAt out of fields before
   * passing to $set. Without this, a caller sending any of these keys gets a
   * cryptic MongoDB write error ("Performing an update on the path '_id' would
   * modify the immutable field") instead of a clean 422 from the validator.
   * Stripping them here means the extra keys are silently ignored, which is
   * the least-surprise behaviour for a bulk-update endpoint.
   *
   * FIX (Issue 8): email.toLowerCase() in the filter (already present).
   * The Mongoose schema stores email in lowercase (lowercase: true). If the
   * caller sends a mixed-case email, the filter would match nothing. The
   * validator normalises it to lowercase before it reaches here, but the
   * .toLowerCase() call is kept as a belt-and-suspenders guard.
   *
   * Note: bulkWrite sends operations directly to the MongoDB driver,
   * bypassing Mongoose middleware and schema validators. This is why
   * the pre-DB validator (userValidators.js) must be airtight — there
   * is no Mongoose safety net here.
   */
  const operations = updates.map(({ email, _id, __v, createdAt, ...fields }) => ({
    updateOne: {
      filter: { email: email.toLowerCase() },
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

    if (notFoundEmails.length > 0) {
      return res.status(207).json({
        message: "Bulk update partially completed. Some emails were not found.",
        matched,
        modified,
        notFound: notFoundEmails.length,
        // FIX (Issue 10): Surface the exact emails that were not found so the
        // caller knows which records to investigate without having to cross-
        // reference the request payload against a bare count.
        notFoundEmails,
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