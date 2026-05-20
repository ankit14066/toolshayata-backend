const mongoose = require("mongoose");

const workflowStepSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    path: { type: String, required: true },
    stepNumber: { type: Number, required: true },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    steps: { type: [workflowStepSchema], required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Workflow || mongoose.model("Workflow", workflowSchema);
