const express = require("express");
const router = express.Router();
const attachmentsCtrl = require("../controllers/attachments");

// Routes: /api/tasks/:taskId/attachments
router.get("/:taskId/attachments/signature", attachmentsCtrl.getSignature);
router.post("/:taskId/attachments", attachmentsCtrl.saveAttachment);
router.get("/:taskId/attachments", attachmentsCtrl.listAttachments);
router.delete("/:taskId/attachments/:attachmentId", attachmentsCtrl.deleteAttachment);

module.exports = router;
