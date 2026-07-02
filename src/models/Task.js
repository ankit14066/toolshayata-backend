const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bucketId: { type: mongoose.Schema.Types.ObjectId, ref: "TaskBucket", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["future", "todo", "in_progress", "completed"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// Virtual populate for attachments
taskSchema.virtual("attachments", {
  ref: "Attachment",
  localField: "_id",
  foreignField: "taskId",
});

// Ensure virtuals are included when converting to JSON
taskSchema.set("toObject", { virtuals: true });
taskSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
