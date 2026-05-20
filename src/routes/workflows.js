const express = require("express");
const Workflow = require("../models/Workflow");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const workflows = await Workflow.find({ userId: req.user.userId }).sort({ updatedAt: -1 });
    return res.json({
      message: "Workflows fetched successfully",
      data: workflows.map((wf) => ({
        id: wf._id.toString(),
        name: wf.name,
        description: wf.description,
        steps: wf.steps,
        isActive: wf.isActive,
        savedAt: wf.updatedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch workflows", error: String(error) });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, description, steps, isActive } = req.body;
    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ message: "Workflow name and steps are required." });
    }

    const workflow = await Workflow.create({
      userId: req.user.userId,
      name: String(name).trim(),
      description: String(description || "").trim(),
      steps,
      isActive: isActive ?? true,
    });

    return res.status(201).json({
      message: "Workflow created successfully",
      data: {
        id: workflow._id.toString(),
        name: workflow.name,
        description: workflow.description,
        steps: workflow.steps,
        isActive: workflow.isActive,
        savedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create workflow", error: String(error) });
  }
});

router.get("/:workflowId", requireAuth, async (req, res) => {
  try {
    const workflow = await Workflow.findOne({ _id: req.params.workflowId, userId: req.user.userId });
    if (!workflow) return res.status(404).json({ message: "Workflow not found" });

    return res.json({
      message: "Workflow fetched successfully",
      data: {
        id: workflow._id.toString(),
        name: workflow.name,
        description: workflow.description,
        steps: workflow.steps,
        isActive: workflow.isActive,
        savedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch workflow", error: String(error) });
  }
});

router.put("/:workflowId", requireAuth, async (req, res) => {
  try {
    const workflow = await Workflow.findOneAndUpdate(
      { _id: req.params.workflowId, userId: req.user.userId },
      {
        ...(req.body.name ? { name: String(req.body.name).trim() } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description || "").trim() } : {}),
        ...(Array.isArray(req.body.steps) ? { steps: req.body.steps } : {}),
        ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
      },
      { new: true }
    );

    if (!workflow) return res.status(404).json({ message: "Workflow not found" });
    return res.json({
      message: "Workflow updated successfully",
      data: {
        id: workflow._id.toString(),
        name: workflow.name,
        description: workflow.description,
        steps: workflow.steps,
        isActive: workflow.isActive,
        savedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update workflow", error: String(error) });
  }
});

router.delete("/:workflowId", requireAuth, async (req, res) => {
  try {
    const deleted = await Workflow.findOneAndDelete({ _id: req.params.workflowId, userId: req.user.userId });
    if (!deleted) return res.status(404).json({ message: "Workflow not found" });
    return res.json({ message: "Workflow deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete workflow", error: String(error) });
  }
});

module.exports = router;
