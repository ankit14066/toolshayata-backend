const express = require("express");
const Task = require("../models/Task");
const TaskBucket = require("../models/TaskBucket");
const { requireAuth } = require("../middleware/auth");
const {
  applyTaskDateFilter,
  ensureDefaultBucket,
  getActiveTaskQuery,
  isValidObjectId,
  taskResponse,
} = require("../services/taskBuckets");

const router = express.Router();

// GET all tasks for logged-in user
router.get("/", requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo, dateField = "dueDate", bucketId } = req.query;
    
    // Ensure default bucket exists and migrate orphaned tasks
    await ensureDefaultBucket(req.user.userId);

    const query = getActiveTaskQuery({ userId: req.user.userId });

    if (bucketId) {
      if (!isValidObjectId(bucketId)) {
        return res.status(400).json({ message: "Invalid bucket id." });
      }

      const bucketExists = await TaskBucket.exists({ _id: bucketId, userId: req.user.userId });
      if (!bucketExists) {
        return res.status(404).json({ message: "Specified bucket not found." });
      }

      query.bucketId = bucketId;
    }

    const { filterDateField, startDate, endDate } = applyTaskDateFilter(query, {
      dateFrom,
      dateTo,
      dateField,
    });

    const tasks = await Task.find(query).sort({ updatedAt: -1 });
    return res.json({
      message: "Tasks fetched successfully",
      filters: {
        dateField: filterDateField,
        dateFrom: startDate,
        dateTo: endDate,
        bucketId: bucketId || null,
      },
      data: tasks.map(taskResponse),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tasks", error: String(error) });
  }
});

// POST create task
router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, bucketId } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "Task title is required." });
    }

    let finalBucketId = bucketId;
    if (!finalBucketId) {
      const defaultBucket = await ensureDefaultBucket(req.user.userId);
      finalBucketId = defaultBucket._id;
    } else {
      if (!isValidObjectId(finalBucketId)) {
        return res.status(400).json({ message: "Invalid bucket id." });
      }

      const bucketExists = await TaskBucket.findOne({ _id: bucketId, userId: req.user.userId });
      if (!bucketExists) {
        return res.status(404).json({ message: "Specified bucket not found." });
      }
    }

    const task = await Task.create({
      userId: req.user.userId,
      bucketId: finalBucketId,
      title: String(title).trim(),
      description: String(description || "").trim(),
      status: status || "todo",
      priority: priority || "medium",
      dueDate: dueDate || null,
    });

    return res.status(201).json({
      message: "Task created successfully",
      data: taskResponse(task),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create task", error: String(error) });
  }
});

// PUT update task (including drag and drop status updates)
router.put("/:taskId", requireAuth, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, bucketId } = req.body;
    if (!isValidObjectId(req.params.taskId)) {
      return res.status(400).json({ message: "Invalid task id." });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = String(title).trim();
    if (description !== undefined) updateData.description = String(description || "").trim();
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate;

    if (bucketId !== undefined) {
      if (!isValidObjectId(bucketId)) {
        return res.status(400).json({ message: "Invalid bucket id." });
      }

      const bucketExists = await TaskBucket.findOne({ _id: bucketId, userId: req.user.userId });
      if (!bucketExists) {
        return res.status(404).json({ message: "Specified bucket not found." });
      }
      updateData.bucketId = bucketId;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.taskId, userId: req.user.userId },
      updateData,
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    return res.json({
      message: "Task updated successfully",
      data: taskResponse(task),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update task", error: String(error) });
  }
});

// DELETE task
router.delete("/:taskId", requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.taskId)) {
      return res.status(400).json({ message: "Invalid task id." });
    }

    const deleted = await Task.findOneAndDelete({ _id: req.params.taskId, userId: req.user.userId });
    if (!deleted) {
      return res.status(404).json({ message: "Task not found." });
    }
    return res.json({ message: "Task deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete task", error: String(error) });
  }
});

module.exports = router;
