const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  loginUserService,
  meUserService,
  registerUserService,
} = require("../services/auth/auth.service");

const router = express.Router();

router.post("/register", registerUserService);
router.post("/login", loginUserService);
router.get("/me", requireAuth, meUserService);
module.exports = router;
