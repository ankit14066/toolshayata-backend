const mongoose = require("mongoose");

const websiteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    domain: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Website || mongoose.model("Website", websiteSchema);
