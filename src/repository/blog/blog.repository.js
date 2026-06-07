const Blog = require("../../schemas/Blog/BlogSchema");
const { slugify } = require("../../utils/slugify");

async function listPublicBlogs() {
  return Blog.find({ published: true }).populate("author", "_id name email").sort({ createdAt: -1 });
}

async function listAdminBlogs() {
  return Blog.find().populate("author", "_id name email").sort({ createdAt: -1 });
}

async function getBlogBySlugOrId(slugOrId) {
  return Blog.findOne({
    $or: [{ slug: slugOrId }, { _id: slugOrId }],
  }).populate("author", "_id name email");
}

async function createBlog({ title, excerpt, content, coverImageUrl = "", published = true, author }) {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 1;

  while (await Blog.findOne({ slug })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return Blog.create({
    title,
    slug,
    excerpt,
    content,
    coverImageUrl,
    published,
    author,
  });
}

async function updateBlog(id, payload) {
  const blog = await Blog.findById(id);
  if (!blog) return null;

  if (payload.title) {
    blog.title = payload.title;
    blog.slug = slugify(payload.title);
  }
  if (payload.excerpt) blog.excerpt = payload.excerpt;
  if (payload.content) blog.content = payload.content;
  if (payload.coverImageUrl !== undefined) blog.coverImageUrl = payload.coverImageUrl;
  if (payload.published !== undefined) blog.published = Boolean(payload.published);

  await blog.save();
  return blog;
}

async function deleteBlog(id) {
  return Blog.findByIdAndDelete(id);
}

async function countBlogs() {
  return {
    totalBlogs: await Blog.countDocuments(),
    publishedBlogs: await Blog.countDocuments({ published: true }),
  };
}

module.exports = {
  countBlogs,
  createBlog,
  deleteBlog,
  getBlogBySlugOrId,
  listAdminBlogs,
  listPublicBlogs,
  updateBlog,
};
