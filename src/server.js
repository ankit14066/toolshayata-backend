const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { connectDatabase } = require("./config/db");
const authRoutes = require("./routes/auth");
const workflowRoutes = require("./routes/workflows");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, message: "Backend is running" });
});

app.use("/auth", authRoutes);
app.use("/workflows", workflowRoutes);

app.use((err, _req, res, _next) => {
  res.status(500).json({ message: "Server error", error: String(err) });
});

connectDatabase()
  .then(() => {
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
