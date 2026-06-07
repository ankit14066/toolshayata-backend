const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  createUserService,
  deleteUserService,
  listUsersService,
  updateUserService,
} = require("../services/user/user.service");

const router = express.Router();

router.get("/", requireAuth, requireRole("admin"), listUsersService);
router.post("/", requireAuth, requireRole("admin"), createUserService);
router.put("/:id", requireAuth, requireRole("admin"), updateUserService);
router.delete("/:id", requireAuth, requireRole("admin"), deleteUserService);

module.exports = router;
