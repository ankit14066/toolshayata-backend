const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getDashboardData } = require("../services/dashboard/dashboard.service");

const router = express.Router();

router.get("/", requireAuth, getDashboardData);
router.get("/counts", requireAuth, getDashboardData);

module.exports = router;
