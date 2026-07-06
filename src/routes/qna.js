const express = require("express");
const axios = require("axios");

const router = express.Router();

// POST /api/qna
router.post("/", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const question =
      typeof req.body?.question === "string" ? req.body.question.trim() : "";

    if (!text) {
      return res.status(400).json({ error: "No document text provided." });
    }

    if (!question) {
      return res.status(400).json({ error: "No question provided." });
    }

    const response = await axios.post(
      "https://ocr-qsiz.onrender.com/api/qna",
      { text, question },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 90000,
        maxBodyLength: Infinity,
      },
    );

    console.log("QnA API response status:", response.status);
    return res.json(response.data);
  } catch (error) {
    console.error("Error in /api/qna:", error.message);

    if (error.code === "ECONNABORTED") {
      return res.status(504).json({
        error:
          "The Q&A server is taking longer than expected. This may take up to 30-60 seconds if the server was asleep. Please try again.",
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data || "Error from downstream Q&A service",
      });
    }

    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
});

module.exports = router;