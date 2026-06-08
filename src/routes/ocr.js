const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Unsupported file type. Only PDF, JPG, and PNG are allowed."));
  },
});

/**
 * Normalize page range input.
 * ""    → "all"  (blank = all pages)
 * "all" → "all"  (explicit all)
 * "3"   → "3"    (single page)
 * "1-4" → "1-4"  (explicit range, unchanged)
 */
function normalizePageRange(input) {
  const val = (input || "").trim().toLowerCase();
  if (!val || val === "all") return "all";
  return val;
}

/**
 * Count pages in a PDF buffer by scanning for /Page objects.
 * Uses a simple regex — no extra dependency needed.
 * Falls back to null if it can't determine the count.
 */
function getPdfPageCount(buffer) {
  try {
    const text = buffer.toString("latin1");
    // PDF stores page count as: /Count N
    const match = text.match(/\/Count\s+(\d+)/);
    if (match) return parseInt(match[1], 10);
    return null;
  } catch {
    return null;
  }
}

// POST /api/ocr
router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let mimeType = req.file.mimetype;
    if (mimeType === "image/jpg") mimeType = "image/jpeg";

    const base64String = req.file.buffer.toString("base64");
    const fileDataUri = `data:${mimeType};base64,${base64String}`;

    let pages = normalizePageRange(req.body.pages);

    // "all" or blank → resolve to actual "1-N" range so Azure gets a valid value
    if (pages === "all") {
      if (mimeType === "application/pdf") {
        const pageCount = getPdfPageCount(req.file.buffer);
        if (pageCount && pageCount > 0) {
          pages = pageCount === 1 ? "1" : `1-${pageCount}`;
          console.log(`PDF has ${pageCount} pages — resolved "all" to "${pages}"`);
        } else {
          // Can't detect count — send without pages param (Azure default = all)
          pages = null;
          console.log(`Could not detect PDF page count — omitting pages param (Azure default = all)`);
        }
      } else {
        // Images are always 1 page
        pages = "1";
      }
    }

    const extractParagraphs = req.body.extractParagraphs === "true";
    const extractTables = req.body.extractTables === "true";
    const extractFields = req.body.extractFields === "true";

    console.log(`OCR request — type: ${mimeType}, size: ${(req.file.size / 1024).toFixed(1)} KB, pages input: "${req.body.pages || "(blank)"}" → sending: "${pages ?? "omitted"}"`);

    const ocrSettings = { extract: true };
    if (extractParagraphs) ocrSettings.paragraphs = { json: true };
    if (extractTables)     ocrSettings.table = { extract: true, include: true, filter: false };
    if (extractFields)     ocrSettings.fields = { extract: true, model: "engine7" };

    // Build settings — omit `pages` entirely if null (lets Azure use its default)
    const settings = { ocr: ocrSettings };
    if (pages !== null) settings.pages = pages;

    const payload = { file: fileDataUri, settings };

    const response = await axios.post("https://ocr-qsiz.onrender.com/api/ocr", payload, {
      headers: { "Content-Type": "application/json" },
      maxBodyLength: Infinity,
    });

    console.log("OCR API response status:", response.status);
    return res.json(response.data);
  } catch (error) {
    console.error("Error in /api/ocr:", error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data || "Error from downstream OCR service",
      });
    }
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ error: "File too large. Max 10 MB allowed." });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

module.exports = router;