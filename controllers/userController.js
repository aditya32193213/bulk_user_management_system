// controllers/userController.js
import User from "../models/User.js";
import AppError from "../utils/AppError.js";

const flattenFields = (obj, prefix = "") => {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
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
export const bulkCreateUsers = async (req, res, next) => {
  const users = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    return next(new AppError("Request body must be a non-empty array.", 400));
  }

  try {
    const result = await User.insertMany(users, {
      ordered: false,
      includeResultMetadata: true,
    });

    const mongooseValidationErrors = result.mongoose?.validationErrors ?? [];

    if (mongooseValidationErrors.length > 0) {
      return res.status(207).json({
        success: true,
        message: "Bulk create partially completed.",
        inserted: result.length,
        failed: mongooseValidationErrors.length,
        total: users.length,
        errors: mongooseValidationErrors.flatMap((e) =>
          Object.values(e.errors || {}).map((ve) => ({
            path: ve.path,
            message: ve.message,
          }))
        ),
      });
    }

    return res.status(201).json({
      success: true,
      message: "Bulk create completed.",
      inserted: result.length,
      total: users.length,
    });
  } catch (err) {
    if (err.name === "MongoBulkWriteError") {
      const inserted = err.insertedDocs?.length ?? err.result?.nInserted ?? 0;
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
};

// ── PUT /api/users/bulk-update ───────────────────────────────────────
export const bulkUpdateUsers = async (req, res, next) => {
  const updates = req.body;

  // FIX: add matching guard to be consistent with bulkCreateUsers
  if (!Array.isArray(updates) || updates.length === 0) {
    return next(new AppError("Request body must be a non-empty array.", 400));
  }

  const emailList = updates
    .filter((u) => typeof u.email === "string" && u.email.length > 0)
    .map((u) => u.email.toLowerCase());

  try {
    const foundDocs = await User.find(
      { email: { $in: emailList } },
      { email: 1, _id: 0 }
    ).lean();

    const matchedEmailSet = new Set(foundDocs.map((d) => d.email));
    const notFoundEmails = emailList.filter((e) => !matchedEmailSet.has(e));

    const operations = updates
      .filter((u) => typeof u.email === "string" && u.email.length > 0)
      .map((update) => {
        const { email, _id, __v, createdAt, updatedAt, ...fields } = update;
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
        matched: err.result?.matchedCount ?? 0,
        modified: err.result?.modifiedCount ?? 0,
        total: updates.length,
        errors: (err.writeErrors || []).map((e) => ({
          index: e.index,
          message: e.errmsg,
        })),
      });
    }
    return next(err);
  }
};