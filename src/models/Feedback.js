const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    message: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
