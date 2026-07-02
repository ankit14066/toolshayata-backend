const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { Readable } = require('stream');
const QRCode = require('qrcode');

const cloudinary = require('../config/cloudinary');
const FileShareBatch = require('../models/FileShareBatch');
const FileShareFile = require('../models/FileShareFile');

const upload = multer({ storage: multer.memoryStorage() });

const MAX_TOTAL_SIZE = parseInt(process.env.FILE_SHARE_MAX_TOTAL_BYTES || String(50 * 1024 * 1024), 10);

function getResourceType(mimeType) {
  if (typeof mimeType !== 'string') return 'raw';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}

function stripExtension(filename) {
  return filename.replace(/\.[^/.]+$/, '');
}

function bufferToCloudinaryUpload(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      return resolve(result);
    });
    Readable.from([buffer]).pipe(stream);
  });
}

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    if (file.size > MAX_TOTAL_SIZE) {
      return res.status(400).json({ error: `Max file size exceeded (${MAX_TOTAL_SIZE} bytes)` });
    }

    const batchUuid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const expireHours = parseInt(process.env.FILE_SHARE_EXPIRE_HOURS || '24', 10);
    const expiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);

    const batch = new FileShareBatch({ uuid: batchUuid, expiresAt, totalSize: file.size, fileCount: 1 });
    await batch.save();

    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const resourceType = getResourceType(file.mimetype);
    const uploadId = resourceType === 'image' || resourceType === 'video'
      ? stripExtension(safeName)
      : safeName;

    const result = await bufferToCloudinaryUpload(file.buffer, {
      resource_type: resourceType,
      public_id: uploadId,
      folder: `qr-file-shares/${batchUuid}`,
      use_filename: true,
      unique_filename: false,
      overwrite: false,
    });

    const fileDoc = new FileShareFile({
      batchId: batch._id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      cloudinaryPublicId: result.public_id,
      cloudinaryVersion: result.version,
      secureUrl: result.secure_url,
      resourceType,
    });
    await fileDoc.save();

    const frontendBase = (process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`)
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');
    const shareUrl = `${frontendBase}/f/${batchUuid}`;
    const qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
      errorCorrectionLevel: 'M',
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    const qrCode = qrCodeDataUrl.split(',')[1];

    return res.json({
      success: true,
      uuid: batchUuid,
      url: shareUrl,
      qrCode,
      dataUrl: qrCodeDataUrl,
      fixNote: "New uploads now use Cloudinary versioning and video/image public_id extension handling. Old broken uploads must be re-uploaded.",
      file: {
        id: fileDoc._id,
        originalName: fileDoc.originalName,
        size: fileDoc.size,
        mimeType: fileDoc.mimeType,
        secureUrl: fileDoc.secureUrl,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/f/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const batch = await FileShareBatch.findOne({ uuid });
    if (!batch) return res.status(404).json({ error: 'Link not found or expired' });

    const files = await FileShareFile.find({ batchId: batch._id }).select('-__v -batchId');
    return res.json({ success: true, batch: { uuid: batch.uuid, expiresAt: batch.expiresAt, deleteAfterFirstDownload: batch.deleteAfterFirstDownload }, files });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

// Download single file by redirecting to a Cloudinary attachment URL
router.get('/f/:uuid/download', async (req, res) => {
  try {
    const { uuid } = req.params;
    const batch = await FileShareBatch.findOne({ uuid });
    if (!batch) return res.status(404).json({ error: 'Link not found or expired' });

    const files = await FileShareFile.find({ batchId: batch._id });
    if (!files.length) return res.status(404).json({ error: 'No file found' });
    const file = files[0];

    const downloadUrl = cloudinary.url(file.cloudinaryPublicId, {
      resource_type: file.resourceType || 'auto',
      secure: true,
      type: 'upload',
      flags: 'attachment',
      version: file.cloudinaryVersion,
    });

    return res.redirect(downloadUrl);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Download failed' });
  }
});

module.exports = router;
