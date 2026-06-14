const Blog = require("../../schemas/Blog/BlogSchema");
const { slugify } = require("../../utils/slugify");

async function listPublicBlogs(website) {
  const query = { isPrivate: false, isActive: true };
  if (website) {
    query.websites = website;
  }
  return Blog.find(query)
    .populate("createdBy", "_id name email")
    .sort({ createdAt: -1 });
}

async function listAdminBlogs() {
  return Blog.find({ isActive: true })
    .populate("createdBy", "_id name email")
    .sort({ createdAt: -1 });
}

async function getBlogBySlugOrId(slugOrId) {
  const mongoose = require("mongoose");
  const orQuery = [{ slug: slugOrId }];
  if (mongoose.Types.ObjectId.isValid(slugOrId)) {
    orQuery.push({ _id: slugOrId });
  }
  return Blog.findOne({
    $or: orQuery,
  }).populate("createdBy", "_id name email");
}

async function createBlog({ title, subTitle, content, coverImage, isPrivate = false, websites = [], tags = [], company, createdBy }) {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 1;

  while (await Blog.findOne({ slug })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const blog = new Blog({
    title,
    subTitle,
    slug,
    content,
    isPrivate,
    websites,
    tags,
    company,
    createdBy,
  });

  const savedBlog = await blog.save();

  if (coverImage && coverImage.buffer) {
    savedBlog.coverImage = {
      name: coverImage.filename,
      url: coverImage.buffer,
      type: coverImage.type,
    };
    await savedBlog.save();
  }

  return savedBlog;
}

async function updateBlog(id, payload) {
  const blog = await Blog.findById(id);
  if (!blog) return null;

  if (payload.title) {
    blog.title = payload.title;
    blog.slug = slugify(payload.title);
  }
  if (payload.subTitle !== undefined) blog.subTitle = payload.subTitle;
  if (payload.content) blog.content = payload.content;
  if (payload.coverImage !== undefined) {
    if (payload.coverImage && payload.coverImage.buffer) {
      blog.coverImage = {
        name: payload.coverImage.filename,
        url: payload.coverImage.buffer,
        type: payload.coverImage.type,
      };
    }
  }
  if (payload.isPrivate !== undefined) blog.isPrivate = Boolean(payload.isPrivate);
  if (payload.websites !== undefined) blog.websites = payload.websites;
  if (payload.tags !== undefined) blog.tags = payload.tags;

  await blog.save();
  return blog;
}

async function deleteBlog(id) {
  return Blog.findByIdAndDelete(id);
}

async function blogStatusCounts(company) {
  const query = {};
  if (company) {
    query.company = { $in: company };
  }

  const result = await Blog.aggregate([
    { $match: query },
    {
      $facet: {
        privateBlogs: [
          { $match: { isPrivate: true, isActive: true } },
          { $count: "count" },
        ],
        publicBlogs: [
          { $match: { isPrivate: false, isActive: true } },
          { $count: "count" },
        ],
        deletedBlogs: [
          { $match: { isActive: false } },
          { $count: "count" },
        ],
      },
    },
    {
      $project: {
        privateBlogs: { $arrayElemAt: ["$privateBlogs.count", 0] },
        publicBlogs: { $arrayElemAt: ["$publicBlogs.count", 0] },
        deletedBlogs: { $arrayElemAt: ["$deletedBlogs.count", 0] },
      },
    },
  ]);

  return result[0] || { privateBlogs: 0, publicBlogs: 0, deletedBlogs: 0 };
}

module.exports = {
  blogStatusCounts,
  createBlog,
  deleteBlog,
  getBlogBySlugOrId,
  listAdminBlogs,
  listPublicBlogs,
  updateBlog,
};
