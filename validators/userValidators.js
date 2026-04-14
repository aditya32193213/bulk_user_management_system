// validators/userValidators.js

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

/*
 * FIX (Issue 11): Changed from /^\d+$/ to /^\d{10,15}$/.
 * The old regex accepted any non-empty digit string, including "1".
 * For an Indian user management system, phone numbers must be 10–15 digits
 * (10 for domestic, up to 15 per ITU-T E.164 international standard).
 */
const PHONE_REGEX = /^\d{10,15}$/;

const VALID_KYC = ["Pending", "Approved", "Rejected"];
const VALID_DEVICE_TYPE = ["Mobile", "Desktop"];
const VALID_OS = ["Android", "iOS", "Windows", "macOS"];

/*
 * MAX_BATCH_SIZE: Hard cap per request.
 * The 50mb Express limit is a blunt instrument — a 50mb payload of minimal
 * user objects could be 500,000+ records. MongoDB insertMany would time out
 * long before Express rejects it. An explicit size cap gives a clean 400
 * error with a meaningful message instead of a cryptic DB timeout.
 */
const MAX_BATCH_SIZE = 10000;


// ── Validates a single user object (used by bulk-create) ─────────────
const validateSingleUser = (user, index) => {
  const errors = [];

  // fullName
  if (!user.fullName || typeof user.fullName !== "string") {
    errors.push(`[${index}] fullName is required and must be a string.`);
  } else if (user.fullName.trim().length < 3) {
    errors.push(`[${index}] fullName must be at least 3 characters.`);
  // FIX (Issue 8): Reject fullNames longer than 100 characters.
  // bulkWrite bypasses Mongoose schema validators so this must be enforced
  // here; without it a very long name would be written directly to the DB.
  } else if (user.fullName.trim().length > 100) {
    errors.push(`[${index}] fullName cannot exceed 100 characters.`);
  }

  // email
  if (!user.email || typeof user.email !== "string") {
    errors.push(`[${index}] email is required.`);
  } else if (!EMAIL_REGEX.test(user.email)) {
    errors.push(`[${index}] email "${user.email}" is not a valid email format.`);
  }

  // phone — FIX (Issue 11): now enforces 10–15 digit minimum
  if (!user.phone || typeof user.phone !== "string") {
    errors.push(`[${index}] phone is required and must be a string.`);
  } else if (!PHONE_REGEX.test(user.phone)) {
    errors.push(`[${index}] phone "${user.phone}" must be a numeric string of 10–15 digits.`);
  }

  // walletBalance (optional; if provided must be a non-negative number)
  if (user.walletBalance !== undefined) {
    if (typeof user.walletBalance !== "number" || user.walletBalance < 0) {
      errors.push(`[${index}] walletBalance must be a non-negative number.`);
    }
  }

  // isBlocked (optional; if provided must be boolean)
  if (user.isBlocked !== undefined && typeof user.isBlocked !== "boolean") {
    errors.push(`[${index}] isBlocked must be a boolean (true or false).`);
  }

  // kycStatus (optional; if provided must be in enum)
  if (user.kycStatus !== undefined && !VALID_KYC.includes(user.kycStatus)) {
    errors.push(
      `[${index}] kycStatus "${user.kycStatus}" is invalid. Must be one of: ${VALID_KYC.join(", ")}.`
    );
  }

  // deviceInfo (optional; sub-fields validated if present)
  if (user.deviceInfo !== undefined) {
    if (typeof user.deviceInfo !== "object" || Array.isArray(user.deviceInfo)) {
      errors.push(`[${index}] deviceInfo must be an object.`);
    } else {
      const { deviceType, os } = user.deviceInfo;

      if (deviceType !== undefined && !VALID_DEVICE_TYPE.includes(deviceType)) {
        errors.push(
          `[${index}] deviceInfo.deviceType "${deviceType}" is invalid. Must be: ${VALID_DEVICE_TYPE.join(", ")}.`
        );
      }
      if (os !== undefined && !VALID_OS.includes(os)) {
        errors.push(
          `[${index}] deviceInfo.os "${os}" is invalid. Must be: ${VALID_OS.join(", ")}.`
        );
      }
    }
  }

  return errors;
};


// ── Bulk Create Validator ────────────────────────────────────────────
export const validateBulkCreate = (req, res, next) => {
  const users = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({
      message: "Request body must be a non-empty JSON array.",
    });
  }

  if (users.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      message: `Batch size cannot exceed ${MAX_BATCH_SIZE} records. Received: ${users.length}.`,
    });
  }

  const allErrors = [];

  /*
   * FIX (Issue 9): Intra-batch duplicate detection.
   * MongoDB's unique index catches DB-level duplicates, but only AFTER a
   * write attempt — meaning the entire bulkWrite fires before you get the
   * error back. Catching duplicates here gives an immediate 422 with clear
   * per-index messages before any DB round-trip occurs.
   * We normalise email to lowercase to match the Mongoose schema
   * (lowercase: true) so "A@X.COM" and "a@x.com" are correctly treated
   * as the same address within the batch.
   */
  const emailsSeen = new Set();
  const phonesSeen = new Set();

  for (let i = 0; i < users.length; i++) {
    
    if (!users[i] || typeof users[i] !== "object" || Array.isArray(users[i])) {
    allErrors.push(`[${i}] Invalid user object.`);
    continue; 
    }

    // ── Intra-batch duplicate check ───────────────────────
    const normalEmail = typeof users[i].email === "string"
      ? users[i].email.toLowerCase()
      : null;

    if (normalEmail) {
      if (emailsSeen.has(normalEmail)) {
        allErrors.push(`[${i}] Duplicate email in this batch: "${normalEmail}".`);
      } else {
        emailsSeen.add(normalEmail);
      }
    }

    const phone = typeof users[i].phone === "string" ? users[i].phone : null;

    if (phone) {
      if (phonesSeen.has(phone)) {
        allErrors.push(`[${i}] Duplicate phone in this batch: "${phone}".`);
      } else {
        phonesSeen.add(phone);
      }
    }

    // ── Per-field validation ──────────────────────────────
    const errors = validateSingleUser(users[i], i);
    if (errors.length) allErrors.push(...errors);

    /*
     * PERF GUARD: Stop after 50 errors.
     * No point validating all 5,000 records if the first 50 are already
     * broken. Protects against malformed bulk payloads hanging the server.
     */
    if (allErrors.length >= 50) {
      allErrors.push("...too many errors, fix the above issues first.");
      break;
    }
  }

  if (allErrors.length > 0) {
    return res.status(422).json({
      message: "Validation failed. Fix the errors before retrying.",
      errorCount: allErrors.length,
      errors: allErrors,
    });
  }

  next();
};


// ── Bulk Update Validator ─────────────────────────────────────────────
export const validateBulkUpdate = (req, res, next) => {
  const updates = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      message: "Request body must be a non-empty JSON array.",
    });
  }

  if (updates.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      message: `Batch size cannot exceed ${MAX_BATCH_SIZE} records. Received: ${updates.length}.`,
    });
  }

  const errors = [];

  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];

    if (!update || typeof update !== "object" || Array.isArray(update)) {
      errors.push(`[${i}] Invalid update object.`);
      continue; 
    }

    const emailDisplay = update.email ?? "(missing)";

    if (!update.email || typeof update.email !== "string") {
      errors.push(`[${i}] email is required to identify the user for update.`);
    } else {
      const normalizedEmail = update.email.toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        errors.push(`[${i}] email "${update.email}" is not valid.`);
      } else {
        // Mutate in place so the controller receives the normalised value
        update.email = normalizedEmail;
      }
    }

    const { email, ...rest } = update;

    if (Object.keys(rest).length === 0) {
      errors.push(`[${i}] No fields provided to update for email "${emailDisplay}".`);
    }

    // fullName (optional; if provided must be valid)
    if (rest.fullName !== undefined) {
      if (typeof rest.fullName !== "string" || rest.fullName.trim().length < 3) {
        errors.push(`[${i}] fullName must be a string with at least 3 characters.`);
      // FIX (Issue 8): Mirror the schema-level maxlength cap here.
      // bulkWrite bypasses Mongoose validators, so this is the only guard.
      } else if (rest.fullName.trim().length > 100) {
        errors.push(`[${i}] fullName cannot exceed 100 characters.`);
      }
    }

    /*
     * FIX (Issue 10): Phone now validated in bulk-update path.
     * bulkWrite bypasses Mongoose schema validators entirely — it sends
     * operations directly to the MongoDB driver. Without this check,
     * a caller could write an invalid phone (e.g. "abc-123") straight
     * into the database, corrupting the unique phone index.
     * FIX (Issue 11): Uses the same 10–15 digit regex as bulk-create.
     */
    if (rest.phone !== undefined) {
      if (typeof rest.phone !== "string" || !PHONE_REGEX.test(rest.phone)) {
        errors.push(
          `[${i}] phone must be a numeric string of 10–15 digits.`
        );
      }
    }

    // walletBalance
    if (rest.walletBalance !== undefined) {
      if (typeof rest.walletBalance !== "number" || rest.walletBalance < 0) {
        errors.push(`[${i}] walletBalance must be a non-negative number.`);
      }
    }

    // isBlocked — must be a boolean, not a truthy string like "yes"
    if (rest.isBlocked !== undefined && typeof rest.isBlocked !== "boolean") {
      errors.push(`[${i}] isBlocked must be a boolean (true or false).`);
    }

    // kycStatus
    if (rest.kycStatus !== undefined && !VALID_KYC.includes(rest.kycStatus)) {
      errors.push(
        `[${i}] kycStatus "${rest.kycStatus}" is invalid. Must be one of: ${VALID_KYC.join(", ")}.`
      );
    }

    /*
     * FIX (Issue 3): Reject deviceInfo: null explicitly.
     * Without this check, a caller sending { deviceInfo: null } would pass
     * the sub-field checks below (both optional-chain guards short-circuit)
     * and reach bulkWrite, where $set: { deviceInfo: null } silently wipes
     * the entire subdocument — overwriting ipAddress, deviceType, and os
     * with a single null. Catching it here gives a clean 422 instead.
     */
    if (rest.deviceInfo !== undefined) {
      if (
        typeof rest.deviceInfo !== "object" ||
        Array.isArray(rest.deviceInfo) ||
        rest.deviceInfo === null
      ) {
        errors.push(`[${i}] deviceInfo must be a plain object.`);
      } else {
        // deviceInfo sub-fields
        if (
          rest.deviceInfo.deviceType !== undefined &&
          !VALID_DEVICE_TYPE.includes(rest.deviceInfo.deviceType)
        ) {
          errors.push(
            `[${i}] deviceInfo.deviceType "${rest.deviceInfo.deviceType}" is invalid. Must be: ${VALID_DEVICE_TYPE.join(", ")}.`
          );
        }
        if (
          rest.deviceInfo.os !== undefined &&
          !VALID_OS.includes(rest.deviceInfo.os)
        ) {
          errors.push(
            `[${i}] deviceInfo.os "${rest.deviceInfo.os}" is invalid. Must be: ${VALID_OS.join(", ")}.`
          );
        }
      }
    }

    if (errors.length >= 50) {
      errors.push("...too many errors, stopping early.");
      break;
    }
  }

  if (errors.length > 0) {
    return res.status(422).json({
      message: "Validation failed.",
      errorCount: errors.length,
      errors,
    });
  }

  next();
};