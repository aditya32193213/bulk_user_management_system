// src/routes/userRoutes.js
import express from "express";
import { bulkCreateUsers, bulkUpdateUsers } from "../controllers/userController.js";
import { validateBulkCreate, validateBulkUpdate } from "../validators/userValidators.js";

const router = express.Router();

// validator runs BEFORE the controller
router.post("/bulk-create", validateBulkCreate, bulkCreateUsers);
router.put("/bulk-update",  validateBulkUpdate,  bulkUpdateUsers);

export default router;