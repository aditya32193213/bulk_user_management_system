// validators/userValidators.js

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const PHONE_REGEX = /^\d{10,15}$/;

const VALID_KYC = ["Pending", "Approved", "Rejected"];
const VALID_DEVICE_TYPE = ["Mobile", "Desktop"];
const VALID_OS = ["Android", "iOS", "Windows", "macOS"];

const MAX_BATCH_SIZE = 10000;


// ── Validates a single user object (used by bulk-create) ─────────────
const validateSingleUser = (user, index) => {
  const errors = [];

  if (!user.fullName || typeof user.fullName !== "string") {
    errors.push(`[${index}] fullName is required and must be a string.`);
  } else if (user.fullName.trim().length < 3) {
    errors.push(`[${index}] fullName must be at least 3 characters.`);
  } else if (user.fullName.trim().length > 100) {
    errors.push(`[${index}] fullName cannot exceed 100 characters.`);
  }

  if (!user.email || typeof user.email !== "string") {
    errors.push(`[${index}] email is required.`);
  } else if (!EMAIL_REGEX.test(user.email)) {
    errors.push(`[${index}] email "${user.email}" is not a valid email format.`);
  }

  if (!user.phone || typeof user.phone !== "string") {
    errors.push(`[${index}] phone is required and must be a string.`);
  } else if (!PHONE_REGEX.test(user.phone)) {
    errors.push(`[${index}] phone "${user.phone}" must be a numeric string of 10–15 digits.`);
  }

  if (user.walletBalance !== undefined) {
    if (typeof user.walletBalance !== "number" || user.walletBalance < 0) {
      errors.push(`[${index}] walletBalance must be a non-negative number.`);
    }
  }

  if (user.isBlocked !== undefined && typeof user.isBlocked !== "boolean") {
    errors.push(`[${index}] isBlocked must be a boolean.`);
  }

  if (user.kycStatus !== undefined && !VALID_KYC.includes(user.kycStatus)) {
    errors.push(
      `[${index}] kycStatus "${user.kycStatus}" is invalid. Must be one of: ${VALID_KYC.join(", ")}.`
    );
  }

  if (user.deviceInfo !== undefined) {
    if (typeof user.deviceInfo !== "object" || Array.isArray(user.deviceInfo)) {
      errors.push(`[${index}] deviceInfo must be an object.`);
    } else {
      const { deviceType, os } = user.deviceInfo;
      if (deviceType !== undefined && !VALID_DEVICE_TYPE.includes(deviceType)) {
        errors.push(`[${index}] deviceInfo.deviceType "${deviceType}" is invalid.`);
      }
      if (os !== undefined && !VALID_OS.includes(os)) {
        errors.push(`[${index}] deviceInfo.os "${os}" is invalid.`);
      }
    }
  }

  return errors;
};


// ── Bulk Create Validator ────────────────────────────────────────────
export const validateBulkCreate = (req, res, next) => {
  const users = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: "Request body must be a non-empty JSON array." });
  }

  if (users.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      message: `Batch size cannot exceed ${MAX_BATCH_SIZE}. Received: ${users.length}.`,
    });
  }

  const allErrors = [];
  const emailsSeen = new Set();
  const phonesSeen = new Set();

  for (let i = 0; i < users.length; i++) {
    if (allErrors.length >= 50) {
      allErrors.push("...too many errors, fix the above issues first.");
      break;
    }

    if (!users[i] || typeof users[i] !== "object" || Array.isArray(users[i])) {
      allErrors.push(`[${i}] Invalid user object.`);
      continue;
    }

    const normalEmail =
      typeof users[i].email === "string" ? users[i].email.toLowerCase() : null;

    if (normalEmail && EMAIL_REGEX.test(normalEmail)) {
      if (emailsSeen.has(normalEmail)) {
        allErrors.push(`[${i}] Duplicate email in this batch: "${normalEmail}".`);
      } else {
        emailsSeen.add(normalEmail);
      }
    }

    const phone = typeof users[i].phone === "string" ? users[i].phone : null;

    if (phone && PHONE_REGEX.test(phone)) {
      if (phonesSeen.has(phone)) {
        allErrors.push(`[${i}] Duplicate phone in this batch: "${phone}".`);
      } else {
        phonesSeen.add(phone);
      }
    }

    const fieldErrors = validateSingleUser(users[i], i);

    if (fieldErrors.length) {
      const slots = 50 - allErrors.length;
      allErrors.push(...fieldErrors.slice(0, slots));
      if (fieldErrors.length > slots) {
        allErrors.push("...too many errors, fix the above issues first.");
        break;
      }
    }
  }

  if (allErrors.length > 0) {
    return res.status(422).json({
      message: "Validation failed.",
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
    return res.status(400).json({ message: "Request body must be a non-empty JSON array." });
  }

  if (updates.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      message: `Batch size cannot exceed ${MAX_BATCH_SIZE}. Received: ${updates.length}.`,
    });
  }

  const errors = [];
  const emailsSeen = new Set();
  const phonesSeen = new Set();

  for (let i = 0; i < updates.length; i++) {
    if (errors.length >= 50) {
      errors.push("...too many errors, fix the above issues first.");
      break;
    }

    const fieldErrors = [];
    const update = updates[i];

    if (!update || typeof update !== "object" || Array.isArray(update)) {
      fieldErrors.push(`[${i}] Invalid update object.`);
    } else {
      let emailValid = false;
      const emailDisplay = update.email ?? "(missing)";

      // ── email (required identifier) ───────────────────────
      if (!update.email || typeof update.email !== "string") {
        fieldErrors.push(`[${i}] email is required.`);
      } else {
        const normalizedEmail = update.email.toLowerCase();
        if (!EMAIL_REGEX.test(normalizedEmail)) {
          fieldErrors.push(`[${i}] email "${update.email}" is not valid.`);
        } else {
          emailValid = true;
          if (emailsSeen.has(normalizedEmail)) {
            fieldErrors.push(`[${i}] Duplicate email in this batch.`);
          } else {
            emailsSeen.add(normalizedEmail);
          }
        }
      }

      const { email, ...rest } = update;

      // ── must have at least one field to update ────────────
      if (emailValid && Object.keys(rest).length === 0) {
        fieldErrors.push(`[${i}] No fields provided for "${emailDisplay}".`);
      }

      // ── fullName (optional in update, but validate if present) ─
      if (rest.fullName !== undefined) {
        if (typeof rest.fullName !== "string") {
          fieldErrors.push(`[${i}] fullName must be a string.`);
        } else if (rest.fullName.trim().length < 3) {
          fieldErrors.push(`[${i}] fullName must be at least 3 characters.`);
        } else if (rest.fullName.trim().length > 100) {
          fieldErrors.push(`[${i}] fullName cannot exceed 100 characters.`);
        }
      }

      // ── phone ─────────────────────────────────────────────
      if (rest.phone !== undefined) {
        if (!PHONE_REGEX.test(rest.phone)) {
          fieldErrors.push(`[${i}] phone is invalid.`);
        } else {
          if (phonesSeen.has(rest.phone)) {
            fieldErrors.push(`[${i}] Duplicate phone in this batch.`);
          } else {
            phonesSeen.add(rest.phone);
          }
        }
      }

      // ── walletBalance ──────────────────────────────────────
      if (rest.walletBalance !== undefined) {
        if (typeof rest.walletBalance !== "number" || rest.walletBalance < 0) {
          fieldErrors.push(`[${i}] walletBalance must be a non-negative number.`);
        }
      }

      // ── isBlocked ──────────────────────────────────────────
      if (rest.isBlocked !== undefined && typeof rest.isBlocked !== "boolean") {
        fieldErrors.push(`[${i}] isBlocked must be a boolean.`);
      }

      // ── kycStatus ──────────────────────────────────────────
      if (rest.kycStatus !== undefined && !VALID_KYC.includes(rest.kycStatus)) {
        fieldErrors.push(
          `[${i}] kycStatus "${rest.kycStatus}" is invalid. Must be one of: ${VALID_KYC.join(", ")}.`
        );
      }

      // ── deviceInfo ─────────────────────────────────────────
      if (rest.deviceInfo !== undefined) {
        if (typeof rest.deviceInfo !== "object" || Array.isArray(rest.deviceInfo)) {
          fieldErrors.push(`[${i}] deviceInfo must be an object.`);
        } else {
          const { deviceType, os } = rest.deviceInfo;
          if (deviceType !== undefined && !VALID_DEVICE_TYPE.includes(deviceType)) {
            fieldErrors.push(`[${i}] deviceInfo.deviceType "${deviceType}" is invalid.`);
          }
          if (os !== undefined && !VALID_OS.includes(os)) {
            fieldErrors.push(`[${i}] deviceInfo.os "${os}" is invalid.`);
          }
        }
      }
    }

    if (fieldErrors.length) {
      const slots = 50 - errors.length;
      errors.push(...fieldErrors.slice(0, slots));
      if (fieldErrors.length > slots) {
        errors.push("...too many errors, fix the above issues first.");
        break;
      }
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