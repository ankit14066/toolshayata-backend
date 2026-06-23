const mongoose = require("mongoose");

const taskBucketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

taskBucketSchema.index({ userId: 1, name: 1 }, { unique: true });
taskBucketSchema.index({ userId: 1, isDefault: 1 });

module.exports = mongoose.models.TaskBucket || mongoose.model("TaskBucket", taskBucketSchema);
