const mongoose = require("mongoose");

const fileShareBatchSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    passwordHash: { type: String },
    deleteAfterFirstDownload: { type: Boolean, default: false },
    totalSize: { type: Number, default: 0 },
    fileCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.models.FileShareBatch || mongoose.model("FileShareBatch", fileShareBatchSchema);
