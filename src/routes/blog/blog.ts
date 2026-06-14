import express from "express";
import authenticate from "../../modules/config/authenticate";
import { deleteBlogById } from "../../modules/blog/blog";
import {
  createBlogService,
  deleteBlogService,
  getBlogByIdService,
  getBlogCountService,
  getBlogsService,
  updateBlogService,
} from "../../services/blog/Blog.service";
import {
  createBlogCommentService,
  getBlogCommentService,
} from "../../services/blogComment/blogComment.service";
const router = express.Router();

router.post("/", authenticate, createBlogService);
router.put("/", authenticate, updateBlogService);
router.post("/get", getBlogsService);
router.get("/", getBlogByIdService);
router.post("/:id", authenticate, deleteBlogService);
router.delete("/:blogId", authenticate, deleteBlogById);
router.post("/status/counts", authenticate, getBlogCountService);
router.post("/comment/:blogId", authenticate, createBlogCommentService);
router.get("/comments/:blogId", getBlogCommentService);

export default router;
