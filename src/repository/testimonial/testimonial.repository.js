const Testimonial = require("../../schemas/Testimonial");

async function listTestimonials(query = {}, page = 1, limit = 10) {
  const total = await Testimonial.countDocuments(query);
  const data = await Testimonial.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  return {
    data,
    totalPages: Math.ceil(total / limit),
  };
}

async function createTestimonial(payload) {
  return Testimonial.create(payload);
}

async function updateTestimonial(id, payload) {
  return Testimonial.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
}

async function deleteTestimonial(id) {
  return Testimonial.findByIdAndDelete(id);
}

async function countTestimonials() {
  return Testimonial.countDocuments();
}

module.exports = {
  countTestimonials,
  createTestimonial,
  deleteTestimonial,
  listTestimonials,
  updateTestimonial,
};
