const Testimonial = require("../../schemas/Testimonial");

async function listTestimonials() {
  return Testimonial.find().sort({ createdAt: -1 });
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
