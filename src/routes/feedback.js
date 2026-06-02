const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');

// POST /feedback - submit feedback
router.post('/', async (req, res) => {
  const { name, email, message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  try {
    const feedback = await Feedback.create({ name, email, message });
    return res.status(201).json({ ok: true, id: feedback._id });
  } catch (err) {
    console.error('Feedback submit error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
