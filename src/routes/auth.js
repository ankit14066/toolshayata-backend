const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "User already exists with this email." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email: String(email).toLowerCase(), passwordHash });
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "Registration successful",
      data: {
        authorization_token: token,
        user: { _id: user._id.toString(), name: user.name, email: user.email },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to register user", error: String(error) });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: String(username).toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid credentials." });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials." });

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful",
      data: {
        authorization_token: token,
        user: { _id: user._id.toString(), name: user.name, email: user.email },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login", error: String(error) });
  }
});

router.post("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("_id name email");
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      message: "User fetched successfully",
      data: { _id: user._id.toString(), name: user.name, email: user.email },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch user", error: String(error) });
  }
});

module.exports = router;
