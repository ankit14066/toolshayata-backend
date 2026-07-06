const Attachment = require("../models/Attachment");
const cloudinary = require("../config/cloudinary");

// GET signature for direct browser upload
exports.getSignature = async (req, res) => {
  try {
    const { taskId } = req.params;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = `tasks/${taskId}`;
    const paramsToSign = { folder, timestamp };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

    return res.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    });
  } catch (error) {
    console.error("Error generating signature:", error);
    return res.status(500).json({ message: "Failed to generate signature" });
  }
};

// POST save attachment metadata after upload
exports.saveAttachment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { file_name, cloudinary_public_id, cloudinary_resource_type, cloudinary_url, file_type, file_size, uploadedBy } = req.body;

    if (!cloudinary_public_id || !cloudinary_url || !file_name) {
      return res.status(400).json({ message: "Missing attachment data" });
    }

    const attachment = await Attachment.create({
      taskId,
      fileName: file_name,
      cloudinaryPublicId: cloudinary_public_id,
      cloudinaryResourceType: cloudinary_resource_type || "image",
      cloudinaryUrl: cloudinary_url,
      fileType: file_type,
      fileSize: file_size,
      uploadedBy: uploadedBy || null,
    });

    return res.status(201).json({ data: attachment });
  } catch (error) {
    console.error("Error saving attachment:", error);
    return res.status(500).json({ message: "Failed to save attachment" });
  }
};

// GET list attachments for a task
exports.listAttachments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const attachments = await Attachment.find({ taskId }).sort({ uploadedAt: -1 });
    return res.json({ data: attachments });
  } catch (error) {
    console.error("Error listing attachments:", error);
    return res.status(500).json({ message: "Failed to list attachments" });
  }
};

// DELETE attachment: remove from Cloudinary and DB
exports.deleteAttachment = async (req, res) => {
  try {
    const { taskId, attachmentId } = req.params;
    const attachment = await Attachment.findById(attachmentId);
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });

    // Delete from Cloudinary — use the stored resource_type ("image", "video", or "raw")
    // NOTE: Cloudinary's destroy() does NOT accept "auto" as resource_type.
    const resourceType = attachment.cloudinaryResourceType || "image";
    const destroyResult = await cloudinary.uploader.destroy(
      attachment.cloudinaryPublicId,
      { resource_type: resourceType }
    );
    console.log("Cloudinary destroy result:", destroyResult);

    await Attachment.deleteOne({ _id: attachmentId });

    return res.json({ message: "Attachment deleted" });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return res.status(500).json({ message: "Failed to delete attachment" });
  }
};
