const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { connectDatabase } = require("./config/db");
const { seedDefaultAdmin } = require("./config/seedAdmin");
const authRoutes = require("./routes/auth");
const workflowRoutes = require("./routes/workflows");
const convertRoutes = require("./routes/convert");
const taskRoutes = require("./routes/tasks");
const feedbackRoutes = require("./routes/feedback");
const dashboardRoutes = require("./routes/dashboard");
const blogRoutes = require("./routes/blogs");
const testimonialRoutes = require("./routes/testimonials");
const userRoutes = require("./routes/users");
const websiteRoutes = require("./routes/websites");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const normalizeOrigin = (value) => value.replace(/\/+$/, "");

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

const corsOptions = {
  credentials: true,
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.length) return callback(null, true);

    const normalizedRequestOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedRequestOrigin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, message: "Backend is running" });
});

app.use("/auth", authRoutes);
app.use("/workflows", workflowRoutes);
app.use("/convert", convertRoutes);
app.use("/tasks", taskRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/blogs", blogRoutes);
app.use("/testimonials", testimonialRoutes);
app.use("/users", userRoutes);
app.use("/websites", websiteRoutes);

app.use((err, _req, res, _next) => {
  res.status(500).json({ message: "Server error", error: String(err) });
});

connectDatabase()
  .then(async () => {
    await seedDefaultAdmin();
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  });

