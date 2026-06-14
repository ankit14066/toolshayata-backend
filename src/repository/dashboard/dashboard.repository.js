const mongoose = require("mongoose");
const { countTestimonials } = require("../testimonial/testimonial.repository");
const { countUsers } = require("../user/user.repository");

async function countBlogs() {
  const Blog = mongoose.models.Blog || mongoose.model("Blog");
  return {
    totalBlogs: await Blog.countDocuments(),
    publishedBlogs: await Blog.countDocuments({ isPrivate: false, isActive: true }),
  };
}

async function getDashboardCounts() {
  const [blogCounts, testimonialCount, userCounts] = await Promise.all([
    countBlogs(),
    countTestimonials(),
    countUsers(),
  ]);

  return {
    ...blogCounts,
    totalTestimonials: testimonialCount,
    ...userCounts,
  };
}

module.exports = { getDashboardCounts };
