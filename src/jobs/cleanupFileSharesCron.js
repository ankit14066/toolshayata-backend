const cron = require('node-cron');
const cloudinary = require('../config/cloudinary');
const FileShareBatch = require('../models/FileShareBatch');
const FileShareFile = require('../models/FileShareFile');

// Runs every hour
cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();
    const expired = await FileShareBatch.find({ expiresAt: { $lte: now } });
    if (!expired.length) return;

    for (const b of expired) {
      const files = await FileShareFile.find({ batchId: b._id });
      for (const f of files) {
        try {
          if (f.cloudinaryPublicId) {
            await cloudinary.uploader.destroy(f.cloudinaryPublicId, { resource_type: f.resourceType || 'auto' });
          }
        } catch (e) {
          // ignore and continue
        }
      }

      await FileShareFile.deleteMany({ batchId: b._id });
      await FileShareBatch.deleteOne({ _id: b._id });
    }
    // eslint-disable-next-line no-console
    console.log(`cleanupFileSharesCron: removed ${expired.length} expired batches`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('cleanupFileSharesCron error', err);
  }
});
