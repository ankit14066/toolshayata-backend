const { countBlogs } = require("../blog/blog.repository");
const { countTestimonials } = require("../testimonial/testimonial.repository");
const { countUsers } = require("../user/user.repository");

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
