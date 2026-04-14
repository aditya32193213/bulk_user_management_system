// controllers/userController.js
import User from "../models/User.js";

const flattenFields = (obj, prefix = "") => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;

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

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: "Request body must be a non-empty array." });
  }

  try {
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
    if (err.name === "MongoBulkWriteError") {
  const inserted = err.result?.insertedCount ?? 0;
  const failed = users.length - inserted;

  const writeErrors = err.writeErrors ?? [];
  const duplicateErrors = writeErrors.filter((e) => e.code === 11000);
  const otherErrors = writeErrors.filter((e) => e.code !== 11000);

  const duplicates = duplicateErrors.length > 0
    ? duplicateErrors.map((e) => ({
        index: e.index,
        message: e.errmsg?.match(/dup key: \{(.+?)\}/)?.[1] ?? "Duplicate key",
      }))
    : undefined;

  const errors = otherErrors.length > 0
    ? otherErrors.map((e) => ({ index: e.index, message: e.errmsg ?? "Write error" }))
    : undefined;

  return res.status(207).json({
    message: "Bulk create partially completed.",
    inserted,
    failed,
    ...(duplicates && { duplicates }),
    ...(errors && { errors }),
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

  const emailList = updates.map((u) => u.email);

  try {
    const foundDocs = await User.find(
      { email: { $in: emailList } },
      { email: 1, _id: 0 }
    ).lean();

    const matchedEmailSet = new Set(foundDocs.map((d) => d.email));
    const notFoundEmails = emailList.filter((e) => !matchedEmailSet.has(e));
    const operations = updates.map(({ email, _id, __v, createdAt, updatedAt, ...fields }) => ({
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

    const result = await User.bulkWrite(operations, { ordered: false });

    const matched = result.matchedCount;
    const modified = result.modifiedCount;

    if (notFoundEmails.length > 0) {
      return res.status(207).json({
        message: "Bulk update partially completed. Some emails were not found.",
        matched,
        modified,
        notFound: notFoundEmails.length,
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