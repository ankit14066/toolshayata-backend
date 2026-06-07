const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    profession: { type: String, required: true, trim: true },
    company: { type: String, default: "", trim: true },
    quote: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    featured: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Testimonial || mongoose.model("Testimonial", testimonialSchema);
