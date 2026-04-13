// src/validators/userValidator.js

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const NUMERIC_REGEX = /^\d+$/;
const VALID_KYC = ["Pending", "Approved", "Rejected"];
const VALID_DEVICE_TYPE = ["Mobile", "Desktop"];
const VALID_OS = ["Android", "iOS", "Windows", "macOS"];

// ── Validates a single user object ──────────────────────────────────
const validateSingleUser = (user, index) => {
  const errors = [];

  // fullName
  if (!user.fullName || typeof user.fullName !== "string") {
    errors.push(`[${index}] fullName is required and must be a string.`);
  } else if (user.fullName.trim().length < 3) {
    errors.push(`[${index}] fullName must be at least 3 characters.`);
  }

  // email
  if (!user.email || typeof user.email !== "string") {
    errors.push(`[${index}] email is required.`);
  } else if (!EMAIL_REGEX.test(user.email)) {
    errors.push(`[${index}] email "${user.email}" is not a valid email format.`);
  }

  // phone
  if (!user.phone || typeof user.phone !== "string") {
    errors.push(`[${index}] phone is required and must be a string.`);
  } else if (!NUMERIC_REGEX.test(user.phone)) {
    errors.push(`[${index}] phone "${user.phone}" must contain only digits.`);
  }

  // walletBalance (optional but if provided, must be valid)
  if (user.walletBalance !== undefined) {
    if (typeof user.walletBalance !== "number" || user.walletBalance < 0) {
      errors.push(`[${index}] walletBalance must be a non-negative number.`);
    }
  }

  // kycStatus (optional but if provided, must be in enum)
  if (user.kycStatus !== undefined && !VALID_KYC.includes(user.kycStatus)) {
    errors.push(
      `[${index}] kycStatus "${user.kycStatus}" is invalid. Must be one of: ${VALID_KYC.join(", ")}.`
    );
  }

  // deviceInfo (optional, but sub-fields validated if present)
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

  const allErrors = [];

  for (let i = 0; i < users.length; i++) {
    const errors = validateSingleUser(users[i], i);
    if (errors.length) allErrors.push(...errors);

    /*
     * PERF GUARD: If errors exceed 50 we stop early.
     * No point validating all 5,000 records if the first 50 are already broken.
     * Protects against malformed bulk payloads hanging the server.
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

  const errors = [];

  // ← changed from forEach to for...of so break actually works
  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];

    if (!update.email || typeof update.email !== "string") {
      errors.push(`[${i}] email is required to identify the user for update.`);
    } else if (!EMAIL_REGEX.test(update.email)) {
      errors.push(`[${i}] email "${update.email}" is not valid.`);
    }

    const { email, ...rest } = update;
    if (Object.keys(rest).length === 0) {
      errors.push(`[${i}] No fields provided to update for email "${update.email}".`);
    }

    if (rest.walletBalance !== undefined) {
      if (typeof rest.walletBalance !== "number" || rest.walletBalance < 0) {
        errors.push(`[${i}] walletBalance must be a non-negative number.`);
      }
    }
    if (rest.kycStatus !== undefined && !VALID_KYC.includes(rest.kycStatus)) {
      errors.push(`[${i}] kycStatus "${rest.kycStatus}" is invalid.`);
    }
    if (rest.deviceInfo?.deviceType !== undefined &&
        !VALID_DEVICE_TYPE.includes(rest.deviceInfo.deviceType)) {
      errors.push(`[${i}] deviceInfo.deviceType "${rest.deviceInfo.deviceType}" is invalid.`);
    }
    if (rest.deviceInfo?.os !== undefined && !VALID_OS.includes(rest.deviceInfo.os)) {
      errors.push(`[${i}] deviceInfo.os "${rest.deviceInfo.os}" is invalid.`);
    }

    if (errors.length >= 50) {        // ← break actually exits the loop now
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