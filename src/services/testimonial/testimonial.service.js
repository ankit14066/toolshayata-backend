const {
  createTestimonial,
  deleteTestimonial,
  listTestimonials,
  updateTestimonial,
} = require("../../repository/testimonial/testimonial.repository");

async function listTestimonialsService(_req, res, next) {
  try {
    const items = await listTestimonials();
    return res.json({ message: "Testimonials fetched successfully", data: items });
  } catch (error) {
    return next(error);
  }
}

async function createTestimonialService(req, res, next) {
  try {
    const { name, profession, company = "", quote, description, imageUrl = "", rating = 5, featured = true } = req.body;
    
    // Map description from frontend to quote
    const finalQuote = quote || description;

    if (!name || !profession || !finalQuote) {
      return res.status(400).json({ message: "Name, profession and quote are required." });
    }

    const item = await createTestimonial({ name, profession, company, quote: finalQuote, imageUrl, rating, featured });
    return res.status(201).json({ message: "Testimonial created successfully", data: item });
  } catch (error) {
    return next(error);
  }
}

async function updateTestimonialService(req, res, next) {
  try {
    const item = await updateTestimonial(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    return res.json({ message: "Testimonial updated successfully", data: item });
  } catch (error) {
    return next(error);
  }
}

async function deleteTestimonialService(req, res, next) {
  try {
    const item = await deleteTestimonial(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    return res.json({ message: "Testimonial deleted successfully" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createTestimonialService,
  deleteTestimonialService,
  listTestimonialsService,
  updateTestimonialService,
};
