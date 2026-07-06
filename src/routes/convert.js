/**
 * FIXED PDF-to-Word Route
 *
 * Problem with LibreOffice approach:
 *   LibreOffice PDF→DOCX conversion mangles tables, fonts, and alignment —
 *   especially for structured documents like invoices.
 *
 * Solution:
 *   1. Use pdfplumber (Python) to extract structured data from the PDF as JSON.
 *   2. Use docx.js to programmatically rebuild the Word document with
 *      exact layout, tables, colors, and formatting.
 *
 * Setup (one-time):
 *   pip install pdfplumber
 *   npm install docx
 *
 * NOTE: The generic route below handles ANY PDF by extracting text blocks
 * and reconstructing them cleanly. For structured invoices or forms, you can
 * extend the invoice-specific builder (see buildInvoiceDocx) for pixel-perfect output.
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { exec, execFileSync, execFile } = require("child_process");
const crypto = require("crypto");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} = require("docx");

const router = express.Router();

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });
const pythonPackagesDir = path.join(__dirname, "../../python_packages");

const isWindows = process.platform === "win32";
const LIBRE_OFFICE = process.env.LIBRE_OFFICE_PATH
  ? process.env.LIBRE_OFFICE_PATH
  : isWindows
    ? `"C:\\Program Files\\LibreOffice\\program\\soffice.exe"`
    : "soffice";
const LIBRE_OFFICE_PROFILE = process.env.LIBRE_OFFICE_PROFILE || "file:///tmp/libreoffice-profile";
const LIBRE_OFFICE_ARGS = isWindows
  ? ""
  : `-env:UserInstallation=${LIBRE_OFFICE_PROFILE}`;
const LIBRE_OFFICE_COMMAND = LIBRE_OFFICE_ARGS
  ? `${LIBRE_OFFICE} ${LIBRE_OFFICE_ARGS}`
  : LIBRE_OFFICE;

function getPythonCommand() {
  return process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
}

function getPythonEnv() {
  const env = { ...process.env };
  if (fs.existsSync(pythonPackagesDir)) {
    env.PYTHONPATH = [pythonPackagesDir, env.PYTHONPATH].filter(Boolean).join(path.delimiter);
  }
  return env;
}

function convertPdfToDocxLayoutLegacySync(pdfPath, docxPath) {
  const script = `
import sys, zipfile, io, os
from pdf2docx import Converter

pdf_path  = sys.argv[1]
docx_path = sys.argv[2]

# ── Step 1: Convert PDF -> DOCX ──────────────────────────────────────────
converter = Converter(pdf_path)
try:
    converter.convert(docx_path, start=0, end=None, multi_processing=False)
finally:
    converter.close()

# ── Step 2: Compress images inside the DOCX (ZIP) ───────────────────────
# DOCX = ZIP. Walk word/media/, compress each image, write back same name.

MAX_DIM = 1200   # max width or height in pixels  (raise for sharper images)
JPEG_Q  = 65     # JPEG quality 0-95              (raise for better quality)
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".tif")

# Try PIL first, fall back to fitz (PyMuPDF) which is bundled
try:
    from PIL import Image as _PILImage
    _USE_PIL = True
except ImportError:
    _USE_PIL = False
    try:
        import fitz as _fitz  # PyMuPDF
        _USE_FITZ = True
    except ImportError:
        _USE_FITZ = False

def compress_image_bytes(raw_bytes):
    """Return JPEG-compressed bytes, or raw_bytes if smaller/error."""
    try:
        if _USE_PIL:
            from PIL import Image
            img = Image.open(io.BytesIO(raw_bytes))
            if img.mode in ("RGBA", "LA", "P"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                if img.mode in ("RGBA", "LA"):
                    bg.paste(img, mask=img.split()[-1])
                else:
                    bg.paste(img)
                img = bg
            else:
                img = img.convert("RGB")
            w, h = img.size
            if w > MAX_DIM or h > MAX_DIM:
                ratio = min(MAX_DIM / w, MAX_DIM / h)
                img = img.resize(
                    (max(1, int(w * ratio)), max(1, int(h * ratio))),
                    Image.LANCZOS,
                )
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=JPEG_Q, optimize=True)
            out = buf.getvalue()

        elif _USE_FITZ:
            import fitz
            pix = fitz.Pixmap(raw_bytes)
            if pix.alpha:
                pix = fitz.Pixmap(fitz.csRGB, pix)  # remove alpha
            w, h = pix.width, pix.height
            if w > MAX_DIM or h > MAX_DIM:
                ratio = min(MAX_DIM / w, MAX_DIM / h)
                pix = pix.resize(
                    max(1, int(w * ratio)),
                    max(1, int(h * ratio)),
                )
            out = pix.tobytes("jpeg", jpg_quality=JPEG_Q)

        else:
            return raw_bytes  # no image lib available

        return out if len(out) < len(raw_bytes) else raw_bytes

    except Exception:
        return raw_bytes  # keep original on any error

tmp_out = docx_path + ".tmp"

with zipfile.ZipFile(docx_path, "r") as zin, \
     zipfile.ZipFile(tmp_out, "w",
                     compression=zipfile.ZIP_DEFLATED,
                     compresslevel=9) as zout:
    for item in zin.infolist():
        raw = zin.read(item.filename)
        low = item.filename.lower()

        if low.startswith("word/media/") and any(low.endswith(e) for e in IMAGE_EXTS):
            raw = compress_image_bytes(raw)

        zout.writestr(item, raw)

os.replace(tmp_out, docx_path)
before = os.path.getsize(docx_path)
print(f"Done. Final size: {before/1024/1024:.2f} MB -> {docx_path}")
`;
  const tmpScript = pdfPath + "_convert.py";
  fs.writeFileSync(tmpScript, script);
  try {
    execFileSync(getPythonCommand(), [tmpScript, pdfPath, docxPath], {
      timeout: 120000,
      env: getPythonEnv(),
    });
  } finally {
    fs.existsSync(tmpScript) && fs.unlinkSync(tmpScript);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Job store & helpers for SSE-based PDF → Word conversion
// ─────────────────────────────────────────────────────────────────────────────

const jobs = new Map(); // jobId → { status, eventBuffer, listeners, previewPdfPath, resultDocxPath }

function generateJobId() {
  return crypto.randomBytes(16).toString("hex");
}

function emitToJob(jobId, event) {
  const job = jobs.get(jobId);
  if (!job) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  job.eventBuffer.push(data);
  for (const res of job.listeners) {
    try { res.write(data); } catch (_) {}
  }
}

function closeJobListeners(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  for (const res of job.listeners) {
    try { res.end(); } catch (_) {}
  }
  job.listeners.clear();
}

// Non-blocking PDF → DOCX conversion using execFile (async, doesn't block Node event loop)
function convertPdfToDocxAsync(pdfPath, docxPath) {
  const script = `
import sys, zipfile, io, os
from pdf2docx import Converter

pdf_path  = sys.argv[1]
docx_path = sys.argv[2]

converter = Converter(pdf_path)
try:
    converter.convert(docx_path, start=0, end=None, multi_processing=False)
finally:
    converter.close()

MAX_DIM = 1200
JPEG_Q  = 65
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".tif")

try:
    from PIL import Image as _PILImage
    _USE_PIL = True
except ImportError:
    _USE_PIL = False
    try:
        import fitz as _fitz
        _USE_FITZ = True
    except ImportError:
        _USE_FITZ = False

def compress_image_bytes(raw_bytes):
    try:
        if _USE_PIL:
            from PIL import Image
            img = Image.open(io.BytesIO(raw_bytes))
            if img.mode in ("RGBA", "LA", "P"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                if img.mode in ("RGBA", "LA"):
                    bg.paste(img, mask=img.split()[-1])
                else:
                    bg.paste(img)
                img = bg
            else:
                img = img.convert("RGB")
            w, h = img.size
            if w > MAX_DIM or h > MAX_DIM:
                ratio = min(MAX_DIM / w, MAX_DIM / h)
                img = img.resize((max(1, int(w * ratio)), max(1, int(h * ratio))), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=JPEG_Q, optimize=True)
            out = buf.getvalue()
        elif _USE_FITZ:
            import fitz
            pix = fitz.Pixmap(raw_bytes)
            if pix.alpha:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            w, h = pix.width, pix.height
            if w > MAX_DIM or h > MAX_DIM:
                ratio = min(MAX_DIM / w, MAX_DIM / h)
                pix = pix.resize(max(1, int(w * ratio)), max(1, int(h * ratio)))
            out = pix.tobytes("jpeg", jpg_quality=JPEG_Q)
        else:
            return raw_bytes
        return out if len(out) < len(raw_bytes) else raw_bytes
    except Exception:
        return raw_bytes

tmp_out = docx_path + ".tmp"
with zipfile.ZipFile(docx_path, "r") as zin, zipfile.ZipFile(tmp_out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zout:
    for item in zin.infolist():
        raw = zin.read(item.filename)
        low = item.filename.lower()
        if low.startswith("word/media/") and any(low.endswith(e) for e in IMAGE_EXTS):
            raw = compress_image_bytes(raw)
        zout.writestr(item, raw)
os.replace(tmp_out, docx_path)
`;
  const tmpScript = pdfPath + "_convert_async.py";
  fs.writeFileSync(tmpScript, script);
  return new Promise((resolve, reject) => {
    execFile(
      getPythonCommand(),
      [tmpScript, pdfPath, docxPath],
      { timeout: 120000, env: getPythonEnv() },
      (err, _stdout, stderr) => {
        try { fs.existsSync(tmpScript) && fs.unlinkSync(tmpScript); } catch (_) {}
        if (err) reject(new Error((stderr || "").trim() || err.message));
        else resolve();
      }
    );
  });
}

// Background pipeline: PDF → DOCX (once) → preview PDF, with SSE progress events
async function convertPdfToDocxLayout(pdfPath, docxPath) {
  return convertPdfToDocxAsync(pdfPath, docxPath);
}

function buildPdfToWordResultUrls(req, jobId) {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return {
    previewUrl: `${baseUrl}/convert/pdf-to-word/result/preview/${jobId}`,
    downloadUrl: `${baseUrl}/convert/pdf-to-word/result/docx/${jobId}`,
  };
}

async function runPdfToWordJob(jobId, inputPath, docxPath) {
  const previewDir = path.resolve(uploadDir);

  function emit(step, pct) {
    emitToJob(jobId, { type: "progress", step, pct });
  }

  try {
    emit("Uploading file...", 5);
    emit("Extracting PDF layout...", 20);
    await convertPdfToDocxAsync(inputPath, docxPath);
    if (jobs.get(jobId)?.status !== "running") {
      [inputPath, docxPath].forEach((f) => {
        try { fs.existsSync(f) && fs.unlinkSync(f); } catch (_) {}
      });
      return;
    }

    emit("Converting to editable Word...", 60);
    emit("Compressing embedded images...", 75);
    emit("Generating preview PDF...", 90);
    await new Promise((resolve, reject) => {
      const cmd = `${LIBRE_OFFICE_COMMAND} --headless --convert-to pdf --outdir "${previewDir}" "${docxPath}"`;
      exec(cmd, (err, _out, stderr) => {
        if (err) reject(new Error("Preview generation failed: " + stderr));
        else resolve();
      });
    });

    const previewPdfPath = path.join(previewDir, path.basename(docxPath, ".docx") + ".pdf");
    if (!fs.existsSync(previewPdfPath)) throw new Error("Preview PDF not found after LibreOffice conversion");
    if (jobs.get(jobId)?.status !== "running") {
      [inputPath, docxPath, previewPdfPath].forEach((f) => {
        try { fs.existsSync(f) && fs.unlinkSync(f); } catch (_) {}
      });
      return;
    }

    const job = jobs.get(jobId);
    if (job) {
      job.status = "done";
      job.previewPdfPath = previewPdfPath;
      job.resultDocxPath = docxPath;
    }

    emitToJob(jobId, {
      type: "done",
      pct: 100,
      step: "Done!",
      previewUrl: `/convert/pdf-to-word/result/preview/${jobId}`,
      downloadUrl: `/convert/pdf-to-word/result/docx/${jobId}`,
    });
    closeJobListeners(jobId);

    try { fs.existsSync(inputPath) && fs.unlinkSync(inputPath); } catch (_) {}

    // Auto-cleanup result files after 10 minutes
    setTimeout(() => {
      const j = jobs.get(jobId);
      if (j) {
        [j.previewPdfPath, j.resultDocxPath].forEach((f) => {
          try { f && fs.existsSync(f) && fs.unlinkSync(f); } catch (_) {}
        });
        jobs.delete(jobId);
      }
    }, 10 * 60 * 1000);

  } catch (err) {
    console.error(`PDF-to-Word job [${jobId}] failed:`, err.message);
    const job = jobs.get(jobId);
    if (job) job.status = "error";
    emitToJob(jobId, { type: "error", step: "Conversion failed", message: err.message });
    closeJobListeners(jobId);
    [inputPath, docxPath].forEach((f) => {
      try { fs.existsSync(f) && fs.unlinkSync(f); } catch (_) {}
    });
    setTimeout(() => jobs.delete(jobId), 60 * 1000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const B = (color = "1F497D") => ({ style: BorderStyle.SINGLE, size: 4, color });
const NO_B = () => ({ style: BorderStyle.NONE, size: 0, color: "FFFFFF" });
const allBorders = (c) => ({ top: B(c), bottom: B(c), left: B(c), right: B(c) });
const noBorders  = ()  => ({ top: NO_B(), bottom: NO_B(), left: NO_B(), right: NO_B() });

function makeCell(text, opts = {}) {
  const {
    bold = false, size = 20, color = "000000",
    align = AlignmentType.LEFT, shading = null,
    colSpan = 1, borders = noBorders(),
    vAlign = VerticalAlign.CENTER, width = null,
  } = opts;
  const c = {
    columnSpan: colSpan,
    verticalAlign: vAlign,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text), bold, size, color, font: "Arial" })],
      }),
    ],
  };
  if (shading) c.shading = shading;
  if (width)   c.width   = width;
  return new TableCell(c);
}

function makePara(text, opts = {}) {
  const { bold = false, size = 20, align = AlignmentType.LEFT, color = "000000", spacing = {} } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { before: 40, after: 40, ...spacing },
    children: [new TextRun({ text: String(text), bold, size, font: "Arial", color })],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract PDF data via pdfplumber (Python subprocess)
// Returns { pages: [{ lines: [string] }], tables: [[rows]] }
// ─────────────────────────────────────────────────────────────────────────────

function extractPdfData(pdfPath) {
  const script = `
import pdfplumber, json, sys

data = {"pages": [], "tables": []}
with pdfplumber.open(sys.argv[1]) as pdf:
    for page in pdf.pages:
        lines = []
        words = page.extract_words(x_tolerance=3, y_tolerance=3)
        if words:
            current_y = words[0]["top"]
            line = []
            for w in words:
                if abs(w["top"] - current_y) > 5:
                    lines.append(" ".join(line))
                    line = [w["text"]]
                    current_y = w["top"]
                else:
                    line.append(w["text"])
            if line:
                lines.append(" ".join(line))
        data["pages"].append({"lines": lines})

        for tbl in page.extract_tables():
            data["tables"].append(tbl)

print(json.dumps(data))
`;
  const tmpScript = pdfPath + "_extract.py";
  fs.writeFileSync(tmpScript, script);
  try {
    const result = execFileSync(getPythonCommand(), [tmpScript, pdfPath], {
      timeout: 30000,
      env: getPythonEnv(),
    });
    return JSON.parse(result.toString());
  } finally {
    fs.existsSync(tmpScript) && fs.unlinkSync(tmpScript);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic DOCX builder — works for any PDF
// ─────────────────────────────────────────────────────────────────────────────

function buildGenericDocx(pdfData) {
  const TW = 9360; // A4 content width in DXA
  const children = [];

  for (const page of pdfData.pages) {
    for (const line of page.lines) {
      if (!line.trim()) continue;
      children.push(makePara(line));
    }
  }

  // Render extracted tables
  for (const tbl of pdfData.tables) {
    if (!tbl || !tbl.length) continue;

    const colCount = Math.max(...tbl.map((r) => r.length));
    const colWidth = Math.floor(TW / colCount);
    const colWidths = Array(colCount).fill(colWidth);

    const rows = tbl.map((row, ri) =>
      new TableRow({
        children: row.map((cellText, ci) =>
          makeCell(cellText || "", {
            borders: allBorders("CCCCCC"),
            shading: ri === 0 ? { fill: "1F497D", type: ShadingType.CLEAR } : null,
            color: ri === 0 ? "FFFFFF" : "000000",
            bold: ri === 0,
            width: { size: colWidths[ci] || colWidth, type: WidthType.DXA },
          })
        ),
      })
    );

    children.push(
      new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: colWidths, rows }),
      makePara("")
    );
  }

  return new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children,
    }],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: POST /pdf-to-word/start — accepts file, launches async job, returns jobId
// ─────────────────────────────────────────────────────────────────────────────

router.post("/pdf-to-word/start", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const jobId = generateJobId();
  const inputPath = path.resolve(req.file.path);
  const docxPath = inputPath + ".docx";

  jobs.set(jobId, {
    status: "running",
    eventBuffer: [],
    listeners: new Set(),
    previewPdfPath: null,
    resultDocxPath: null,
  });

  res.json({ jobId, ...buildPdfToWordResultUrls(req, jobId) });

  // Emit first event (will be buffered for clients that connect after this)
  emitToJob(jobId, { type: "progress", step: "Uploading file...", pct: 5 });

  const timeoutId = setTimeout(() => {
    const job = jobs.get(jobId);
    if (!job || job.status !== "running") return;
    job.status = "error";
    emitToJob(jobId, {
      type: "error",
      step: "Conversion timed out",
      message: "Conversion exceeded 120 seconds. Please retry with a smaller PDF.",
      timedOut: true,
    });
    closeJobListeners(jobId);
  }, 120000);

  // Run in background — does NOT block the HTTP response
  runPdfToWordJob(jobId, inputPath, docxPath)
    .catch(console.error)
    .finally(() => clearTimeout(timeoutId));
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: GET /pdf-to-word/progress/:jobId — SSE stream for real-time progress
// ─────────────────────────────────────────────────────────────────────────────

router.get("/pdf-to-word/progress/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx proxy buffering
  res.flushHeaders();

  // Replay buffered events so late-connecting clients catch up
  for (const data of job.eventBuffer) {
    res.write(data);
  }

  if (job.status === "done" || job.status === "error") {
    res.end();
    return;
  }

  job.listeners.add(res);
  req.on("close", () => job.listeners.delete(res));
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: GET /pdf-to-word/result/preview/:jobId — serves the preview PDF
// ─────────────────────────────────────────────────────────────────────────────

router.get("/pdf-to-word/result/preview/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "done" || !job.previewPdfPath || !fs.existsSync(job.previewPdfPath)) {
    return res.status(404).json({ error: "Preview not available" });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="preview.pdf"');
  res.setHeader("Cache-Control", "private, no-store");
  fs.createReadStream(job.previewPdfPath).pipe(res);
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: GET /pdf-to-word/result/docx/:jobId — serves the converted DOCX
// ─────────────────────────────────────────────────────────────────────────────

router.get("/pdf-to-word/result/docx/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "done" || !job.resultDocxPath || !fs.existsSync(job.resultDocxPath)) {
    return res.status(404).json({ error: "Converted file not available" });
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", 'attachment; filename="converted.docx"');
  res.setHeader("Cache-Control", "private, no-store");
  fs.createReadStream(job.resultDocxPath).pipe(res);
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: POST /pdf-to-word  (legacy synchronous route — kept for compatibility)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/pdf-to-word", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const inputPath  = path.resolve(req.file.path);
  const outputPath = inputPath + ".docx";
  const originalName = path.basename(req.file.originalname, path.extname(req.file.originalname));

  try {
    await convertPdfToDocxAsync(inputPath, outputPath);
    const buffer = fs.readFileSync(outputPath);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${originalName}.docx"`);
    res.send(buffer);

  } catch (err) {
    console.error("PDF→DOCX error:", err);
    res.status(500).json({ error: "Conversion failed", detail: err.message });
  } finally {
    fs.existsSync(inputPath) && fs.unlinkSync(inputPath);
    fs.existsSync(outputPath) && fs.unlinkSync(outputPath);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: POST /pdf-to-word/preview
// Converts the uploaded PDF → DOCX (same pipeline), then DOCX → PDF via
// LibreOffice, and streams the resulting PDF so the browser can render it as
// an inline preview. No file is permanently stored.
// ─────────────────────────────────────────────────────────────────────────────

router.post("/pdf-to-word/preview", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const inputPath  = path.resolve(req.file.path);
  const docxPath   = inputPath + ".docx";
  const previewDir = path.resolve(uploadDir);

  try {
    // Step 1: PDF → DOCX (existing converter)
    await convertPdfToDocxAsync(inputPath, docxPath);

    // Step 2: DOCX → PDF via LibreOffice (for browser-renderable preview)
    await new Promise((resolve, reject) => {
      const cmd = `${LIBRE_OFFICE_COMMAND} --headless --convert-to pdf --outdir "${previewDir}" "${docxPath}"`;
      exec(cmd, (err, _stdout, stderr) => {
        if (err) {
          console.error("LibreOffice preview error:", stderr);
          reject(new Error("Preview PDF generation failed"));
        } else {
          resolve();
        }
      });
    });

    const previewPdfPath = path.join(previewDir, path.basename(docxPath, ".docx") + ".pdf");

    if (!fs.existsSync(previewPdfPath)) {
      return res.status(500).json({ error: "Preview PDF not generated" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"preview.pdf\"");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    const stream = fs.createReadStream(previewPdfPath);
    stream.pipe(res);

    const cleanup = () => {
      [inputPath, docxPath, previewPdfPath].forEach((f) => {
        try { fs.existsSync(f) && fs.unlinkSync(f); } catch (_) {}
      });
    };

    stream.on("end", cleanup);
    stream.on("error", cleanup);

  } catch (err) {
    console.error("PDF→preview error:", err);
    [inputPath, docxPath].forEach((f) => {
      try { fs.existsSync(f) && fs.unlinkSync(f); } catch (_) {}
    });
    res.status(500).json({ error: "Preview generation failed", detail: err.message });
  }
});

router.post("/word-to-pdf", upload.single("file"), (req, res) => {

  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const tempPath   = path.resolve(req.file.path);
  const inputPath  = tempPath + ".docx";          // LibreOffice needs .docx extension
  const outputDir  = path.resolve(uploadDir);
  const originalName = path.basename(
    req.file.originalname,
    path.extname(req.file.originalname)
  );

  // Rename multer's extension-less temp file so LibreOffice recognises the format
  try {
    fs.renameSync(tempPath, inputPath);
  } catch (renameErr) {
    console.error("Rename error:", renameErr);
    return res.status(500).json({ error: "Failed to prepare file for conversion" });
  }

  const cmd = `${LIBRE_OFFICE_COMMAND} --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("LibreOffice error:", stderr);
      fs.existsSync(inputPath) && fs.unlinkSync(inputPath);
      return res.status(500).json({ error: "Conversion failed", detail: stderr });
    }

    // LibreOffice outputs: <basename-without-ext>.pdf  → e.g. abc123.pdf
    const pdfBasename = path.basename(inputPath, ".docx") + ".pdf";
    const pdfPath = path.join(outputDir, pdfBasename);

    if (!fs.existsSync(pdfPath)) {
      console.error("PDF not found at:", pdfPath, "stdout:", stdout, "stderr:", stderr);
      fs.existsSync(inputPath) && fs.unlinkSync(inputPath);
      return res.status(500).json({ error: "PDF not generated" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${originalName}.pdf"`
    );

    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);

    stream.on("end", () => {
      fs.existsSync(inputPath) && fs.unlinkSync(inputPath);
      fs.existsSync(pdfPath)   && fs.unlinkSync(pdfPath);
    });

    stream.on("error", () => {
      fs.existsSync(inputPath) && fs.unlinkSync(inputPath);
      fs.existsSync(pdfPath)   && fs.unlinkSync(pdfPath);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL: Invoice-specific builder (pixel-perfect for TechSahayata invoices)
// Swap into the route above: const doc = buildInvoiceDocx(invoiceData);
// ─────────────────────────────────────────────────────────────────────────────

function buildInvoiceDocx(data) {
  /*
   * data shape (parse from pdfData yourself, or hardcode for a fixed template):
   * {
   *   seller:   { name, gstin, address: [lines] },
   *   invoiceNo, invoiceDate,
   *   customer: { name, gstin },
   *   billing:  { address: [lines] },
   *   items:    [{ no, desc, qty, taxable, gst, amount }],
   *   totals:   { taxable, igst, total, igstRate },
   *   bank:     { name, account, ifsc },
   *   terms:    [lines],
   * }
   */

  const TW = 9360;
  const headerShade = { fill: "1F497D", type: ShadingType.CLEAR };
  const lightShade  = { fill: "EBF1F9", type: ShadingType.CLEAR };

  const itemRows = data.items.map((item) =>
    new TableRow({
      children: [
        makeCell(item.no,      { align: AlignmentType.CENTER, borders: allBorders("CCCCCC"), width: { size: 480,  type: WidthType.DXA } }),
        makeCell(item.desc,    { borders: allBorders("CCCCCC"), width: { size: 3500, type: WidthType.DXA } }),
        makeCell(item.qty,     { align: AlignmentType.CENTER, borders: allBorders("CCCCCC"), width: { size: 900,  type: WidthType.DXA } }),
        makeCell(item.taxable, { align: AlignmentType.RIGHT,  borders: allBorders("CCCCCC"), width: { size: 1440, type: WidthType.DXA } }),
        makeCell(item.gst,     { align: AlignmentType.RIGHT,  borders: allBorders("CCCCCC"), width: { size: 1440, type: WidthType.DXA } }),
        makeCell(item.amount,  { align: AlignmentType.RIGHT,  borders: allBorders("CCCCCC"), width: { size: 1600, type: WidthType.DXA } }),
      ],
    })
  );

  return new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: [
        makePara("TAX INVOICE", { bold: true, size: 36, align: AlignmentType.CENTER, spacing: { before: 0, after: 160 } }),

        // Seller + Invoice info
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: [4680, 4680],
          rows: [new TableRow({ children: [
            new TableCell({
              width: { size: 4680, type: WidthType.DXA }, borders: noBorders(),
              margins: { top: 60, bottom: 60, left: 0, right: 120 },
              children: [
                makePara(data.seller.name, { bold: true, size: 22 }),
                makePara(`GSTIN: ${data.seller.gstin}`),
                ...data.seller.address.map((l) => makePara(l)),
              ],
            }),
            new TableCell({
              width: { size: 4680, type: WidthType.DXA }, borders: noBorders(),
              margins: { top: 60, bottom: 60, left: 120, right: 0 },
              children: [
                makePara("ORIGINAL FOR RECIPIENTS", { bold: true, align: AlignmentType.RIGHT }),
                makePara(""),
                makePara(`Invoice No: ${data.invoiceNo}`, { align: AlignmentType.RIGHT }),
                makePara(`Invoice Date: ${data.invoiceDate}`, { align: AlignmentType.RIGHT }),
              ],
            }),
          ]})],
        }),

        makePara(""),

        // Customer + Billing
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: [4680, 4680],
          rows: [new TableRow({ children: [
            new TableCell({
              width: { size: 4680, type: WidthType.DXA }, borders: allBorders("AAAAAA"),
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                makePara("Customer Details:", { bold: true }),
                makePara(data.customer.name),
                makePara(`GSTIN: ${data.customer.gstin}`),
              ],
            }),
            new TableCell({
              width: { size: 4680, type: WidthType.DXA }, borders: allBorders("AAAAAA"),
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                makePara("Billing Address:", { bold: true, align: AlignmentType.RIGHT }),
                ...data.billing.address.map((l) => makePara(l, { align: AlignmentType.RIGHT })),
              ],
            }),
          ]})],
        }),

        makePara(""),

        // Line items
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: [480, 3500, 900, 1440, 1440, 1600],
          rows: [
            new TableRow({ children: [
              makeCell("#",               { bold: true, size: 18, color: "FFFFFF", shading: headerShade, align: AlignmentType.CENTER, borders: allBorders("1F497D"), width: { size: 480,  type: WidthType.DXA } }),
              makeCell("Item Description",{ bold: true, size: 18, color: "FFFFFF", shading: headerShade, borders: allBorders("1F497D"), width: { size: 3500, type: WidthType.DXA } }),
              makeCell("Qty",             { bold: true, size: 18, color: "FFFFFF", shading: headerShade, align: AlignmentType.CENTER, borders: allBorders("1F497D"), width: { size: 900,  type: WidthType.DXA } }),
              makeCell("Taxable Value",   { bold: true, size: 18, color: "FFFFFF", shading: headerShade, align: AlignmentType.RIGHT,  borders: allBorders("1F497D"), width: { size: 1440, type: WidthType.DXA } }),
              makeCell("GST Amount",      { bold: true, size: 18, color: "FFFFFF", shading: headerShade, align: AlignmentType.RIGHT,  borders: allBorders("1F497D"), width: { size: 1440, type: WidthType.DXA } }),
              makeCell("Amount",          { bold: true, size: 18, color: "FFFFFF", shading: headerShade, align: AlignmentType.RIGHT,  borders: allBorders("1F497D"), width: { size: 1600, type: WidthType.DXA } }),
            ]}),
            ...itemRows,
          ],
        }),

        makePara(""),

        // Totals
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: [7760, 1600],
          rows: [
            new TableRow({ children: [
              makeCell("Taxable Amount", { bold: true, borders: allBorders("CCCCCC"), shading: lightShade, width: { size: 7760, type: WidthType.DXA } }),
              makeCell(data.totals.taxable, { bold: true, align: AlignmentType.RIGHT, borders: allBorders("CCCCCC"), shading: lightShade, width: { size: 1600, type: WidthType.DXA } }),
            ]}),
            new TableRow({ children: [
              makeCell(`IGST ${data.totals.igstRate}`, { bold: true, borders: allBorders("CCCCCC"), shading: lightShade, width: { size: 7760, type: WidthType.DXA } }),
              makeCell(data.totals.igst, { bold: true, align: AlignmentType.RIGHT, borders: allBorders("CCCCCC"), shading: lightShade, width: { size: 1600, type: WidthType.DXA } }),
            ]}),
            new TableRow({ children: [
              makeCell("Total Amount",  { bold: true, size: 22, borders: allBorders("1F497D"), shading: headerShade, color: "FFFFFF", width: { size: 7760, type: WidthType.DXA } }),
              makeCell(data.totals.total, { bold: true, size: 22, align: AlignmentType.RIGHT, borders: allBorders("1F497D"), shading: headerShade, color: "FFFFFF", width: { size: 1600, type: WidthType.DXA } }),
            ]}),
          ],
        }),

        makePara(""),

        // Bank + Signatory
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: [5000, 4360],
          rows: [new TableRow({ children: [
            new TableCell({
              width: { size: 5000, type: WidthType.DXA }, borders: noBorders(),
              margins: { top: 80, bottom: 80, left: 0, right: 120 },
              children: [
                makePara("Bank Details:", { bold: true }),
                makePara(`Bank: ${data.bank.name}`),
                makePara(`A/C No: ${data.bank.account}`),
                makePara(`IFSC: ${data.bank.ifsc}`),
              ],
            }),
            new TableCell({
              width: { size: 4360, type: WidthType.DXA }, borders: noBorders(),
              margins: { top: 80, bottom: 80, left: 120, right: 0 },
              children: [
                makePara(`For ${data.seller.name}`, { bold: true, align: AlignmentType.RIGHT }),
                makePara(""),
                makePara(""),
                makePara("Authorized Signatory", { align: AlignmentType.RIGHT }),
              ],
            }),
          ]})],
        }),

        makePara(""),

        makePara("Terms & Conditions:", { bold: true, size: 18 }),
        ...data.terms.map((t, i) => makePara(`${i + 1}. ${t}`, { size: 18 })),
      ],
    }],
  });
}

module.exports = router;
