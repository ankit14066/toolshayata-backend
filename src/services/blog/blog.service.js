const {
  createBlog,
  deleteBlog,
  getBlogBySlugOrId,
  listAdminBlogs,
  listPublicBlogs,
  updateBlog,
} = require("../../repository/blog/blog.repository");

async function listAdminBlogsService(_req, res, next) {
  try {
    const blogs = await listAdminBlogs();
    return res.json({ message: "Blogs fetched successfully", data: blogs });
  } catch (error) {
    return next(error);
  }
}

async function listPublicBlogsService(_req, res, next) {
  try {
    const blogs = await listPublicBlogs();
    return res.json({ message: "Blogs fetched successfully", data: blogs });
  } catch (error) {
    return next(error);
  }
}

async function getBlogService(req, res, next) {
  try {
    const blog = await getBlogBySlugOrId(req.params.slugOrId);
    if (!blog || !blog.published) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json({ message: "Blog fetched successfully", data: blog });
  } catch (error) {
    return next(error);
  }
}

async function createBlogService(req, res, next) {
  try {
    const blog = await createBlog({ ...req.body, author: req.user.userId });
    return res.status(201).json({ message: "Blog created successfully", data: blog });
  } catch (error) {
    return next(error);
  }
}

async function updateBlogService(req, res, next) {
  try {
    const blog = await updateBlog(req.params.id, req.body);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json({ message: "Blog updated successfully", data: blog });
  } catch (error) {
    return next(error);
  }
}

async function deleteBlogService(req, res, next) {
  try {
    const blog = await deleteBlog(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createBlogService,
  deleteBlogService,
  getBlogService,
  listAdminBlogsService,
  listPublicBlogsService,
  updateBlogService,
};
