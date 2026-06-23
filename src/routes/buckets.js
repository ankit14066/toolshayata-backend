const express = require("express");
const TaskBucket = require("../models/TaskBucket");
const Task = require("../models/Task");
const { requireAuth } = require("../middleware/auth");
const {
  applyTaskDateFilter,
  bucketResponse,
  ensureDefaultBucket,
  escapeRegex,
  getActiveTaskQuery,
  isValidObjectId,
  taskResponse,
} = require("../services/taskBuckets");

const router = express.Router();

// GET all buckets for logged-in user with task counts
router.get("/", requireAuth, async (req, res) => {
  try {
    await ensureDefaultBucket(req.user.userId);

    const buckets = await TaskBucket.find({ userId: req.user.userId }).sort({ createdAt: 1 });
    const taskCounts = buckets.length
      ? await Task.aggregate([
          {
            $match: (() => {
              const countMatch = getActiveTaskQuery({
                userId: buckets[0].userId,
                bucketId: { $in: buckets.map((bucket) => bucket._id) },
              });
              applyTaskDateFilter(countMatch, req.query);
              return countMatch;
            })(),
          },
          { $group: { _id: "$bucketId", taskCount: { $sum: 1 } } },
        ])
      : [];
    const countByBucketId = new Map(
      taskCounts.map((item) => [item._id.toString(), item.taskCount])
    );

    const bucketsWithCount = buckets.map((bucket) =>
      bucketResponse(bucket, { taskCount: countByBucketId.get(bucket._id.toString()) || 0 })
    );

    return res.json({
      message: "Buckets fetched successfully",
      data: bucketsWithCount,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch buckets", error: String(error) });
  }
});

// GET a specific bucket and its tasks
router.get("/:bucketId", requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.bucketId)) {
      return res.status(400).json({ message: "Invalid bucket id." });
    }

    const bucket = await TaskBucket.findOne({ _id: req.params.bucketId, userId: req.user.userId });
    if (!bucket) {
      return res.status(404).json({ message: "Bucket not found." });
    }

    const taskQuery = getActiveTaskQuery({ userId: req.user.userId, bucketId: bucket._id });
    applyTaskDateFilter(taskQuery, req.query);
    const tasks = await Task.find(taskQuery).sort({ updatedAt: -1 });

    return res.json({
      message: "Bucket and tasks fetched successfully",
      data: {
        bucket: {
          ...bucketResponse(bucket),
        },
        tasks: tasks.map(taskResponse),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch bucket details", error: String(error) });
  }
});

// POST create a new bucket
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Bucket name is required." });
    }

    const trimmedName = String(name).trim();

    // Check if user already has a bucket with the same name (case-insensitive check)
    const existing = await TaskBucket.findOne({
      userId: req.user.userId,
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
    });

    if (existing) {
      return res.status(409).json({ message: "A bucket with this name already exists." });
    }

    const bucket = await TaskBucket.create({
      userId: req.user.userId,
      name: trimmedName,
      isDefault: false,
    });

    return res.status(201).json({
      message: "Bucket created successfully",
      data: bucketResponse(bucket, { taskCount: 0 }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create bucket", error: String(error) });
  }
});

// PUT update bucket name
router.put("/:bucketId", requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.bucketId)) {
      return res.status(400).json({ message: "Invalid bucket id." });
    }

    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Bucket name is required." });
    }

    const trimmedName = String(name).trim();

    // Verify bucket exists and belongs to the user
    const bucket = await TaskBucket.findOne({ _id: req.params.bucketId, userId: req.user.userId });
    if (!bucket) {
      return res.status(404).json({ message: "Bucket not found." });
    }

    // Check if another bucket has the same name
    const existing = await TaskBucket.findOne({
      userId: req.user.userId,
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
      _id: { $ne: bucket._id },
    });

    if (existing) {
      return res.status(409).json({ message: "Another bucket with this name already exists." });
    }

    bucket.name = trimmedName;
    await bucket.save();

    return res.json({
      message: "Bucket updated successfully",
      data: bucketResponse(bucket, {
        taskCount: await Task.countDocuments(
          getActiveTaskQuery({ userId: req.user.userId, bucketId: bucket._id })
        ),
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update bucket", error: String(error) });
  }
});

// DELETE a bucket (Cascade deletes all its tasks, blocks default bucket deletion)
router.delete("/:bucketId", requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.bucketId)) {
      return res.status(400).json({ message: "Invalid bucket id." });
    }

    const bucket = await TaskBucket.findOne({ _id: req.params.bucketId, userId: req.user.userId });
    if (!bucket) {
      return res.status(404).json({ message: "Bucket not found." });
    }

    if (bucket.isDefault) {
      return res.status(400).json({ message: "Cannot delete the default bucket." });
    }

    // Cascade delete tasks in this bucket
    await Task.deleteMany({ userId: req.user.userId, bucketId: bucket._id });

    // Delete the bucket itself
    await TaskBucket.deleteOne({ _id: bucket._id });

    return res.json({
      message: "Bucket and its tasks deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete bucket", error: String(error) });
  }
});

module.exports = router;
