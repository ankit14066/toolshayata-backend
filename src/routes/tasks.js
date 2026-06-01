const express = require("express");
const Task = require("../models/Task");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET all tasks for logged-in user
router.get("/", requireAuth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.userId }).sort({ updatedAt: -1 });
    return res.json({
      message: "Tasks fetched successfully",
      data: tasks.map((task) => ({
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tasks", error: String(error) });
  }
});

// POST create task
router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate } = req.body;
    if (!title) {
      return res.status(400).json({ message: "Task title is required." });
    }

    const task = await Task.create({
      userId: req.user.userId,
      title: String(title).trim(),
      description: String(description || "").trim(),
      status: status || "todo",
      priority: priority || "medium",
      dueDate: dueDate || null,
    });

    return res.status(201).json({
      message: "Task created successfully",
      data: {
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create task", error: String(error) });
  }
});

// PUT update task (including drag and drop status updates)
router.put("/:taskId", requireAuth, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = String(title).trim();
    if (description !== undefined) updateData.description = String(description || "").trim();
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate;

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
      data: {
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update task", error: String(error) });
  }
});

// DELETE task
router.delete("/:taskId", requireAuth, async (req, res) => {
  try {
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
