const mongoose = require("mongoose");

const fileShareFileSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "FileShareBatch", required: true, index: true },
    originalName: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    cloudinaryPublicId: { type: String, required: true },
    cloudinaryVersion: { type: Number, required: true },
    secureUrl: { type: String, required: true },
    resourceType: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.FileShareFile || mongoose.model("FileShareFile", fileShareFileSchema);
