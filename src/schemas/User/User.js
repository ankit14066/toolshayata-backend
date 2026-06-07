const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    username: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String },
    password: { type: String },
    role: {
      type: String,
      default: "editor",
    },
    userType: { type: String },
    isActive: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    permissions: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
