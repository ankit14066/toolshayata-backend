const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  createBlogService,
  deleteBlogService,
  getBlogService,
  listAdminBlogsService,
  listPublicBlogsService,
  updateBlogService,
} = require("../services/blog/blog.service");

const router = express.Router();

router.get("/admin/list", requireAuth, requireRole("admin", "editor"), listAdminBlogsService);
router.get("/", listPublicBlogsService);
router.get("/get", listPublicBlogsService);
router.get("/:slugOrId", getBlogService);
router.post("/", requireAuth, requireRole("admin", "editor"), createBlogService);
router.put("/:id", requireAuth, requireRole("admin", "editor"), updateBlogService);
router.delete("/:id", requireAuth, requireRole("admin", "editor"), deleteBlogService);
router.post("/:id", requireAuth, requireRole("admin", "editor"), deleteBlogService);

module.exports = router;
