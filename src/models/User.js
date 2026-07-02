const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

// Fast login lookup — required for O(log n) email queries instead of O(n) collection scan
userSchema.index({ email: 1 });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);