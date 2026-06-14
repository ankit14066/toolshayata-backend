const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      index: true,
    },
    subTitle: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
    },
    category: {
      type: String,
    },
    coverImage: {
      name: { type: String },
      url: { type: String },
      public_id: { type: String },
      type: { type: String },
    },
    content: {
      type: String,
      required: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    tags: [String],
    websites: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    reactions: [
      {
        user: {
          type: mongoose.Types.ObjectId,
          ref: "User",
          required: true,
        },
        type: {
          type: String,
          required: true,
        },
      },
    ],
    comments: [
      {
        type: mongoose.Types.ObjectId,
        ref: "BlogComment",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
    },
  }
);

module.exports = mongoose.models.Blog || mongoose.model("Blog", blogSchema);
