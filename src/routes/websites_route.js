const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  listWebsitesService,
  createWebsiteService,
  updateWebsiteService,
  deleteWebsiteService,
} = require("../services/website/website.service");

const router = express.Router();

router.get("/", listWebsitesService);
router.post("/", requireAuth, requireRole("admin", "editor"), createWebsiteService);
router.put("/:id", requireAuth, requireRole("admin", "editor"), updateWebsiteService);
router.delete("/:id", requireAuth, requireRole("admin", "editor"), deleteWebsiteService);

module.exports = router;
