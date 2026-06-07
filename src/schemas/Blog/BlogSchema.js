const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    excerpt: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    coverImageUrl: { type: String, default: "" },
    published: { type: Boolean, default: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Blog || mongoose.model("Blog", blogSchema);
