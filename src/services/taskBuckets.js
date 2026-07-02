const mongoose = require("mongoose");
const TaskBucket = require("../models/TaskBucket");
const Task = require("../models/Task");

const DEFAULT_BUCKET_NAME = "My Bucket";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const bucketResponse = (bucket, extras = {}) => ({
  id: bucket._id.toString(),
  name: bucket.name,
  isDefault: bucket.isDefault,
  createdAt: bucket.createdAt,
  updatedAt: bucket.updatedAt,
  ...extras,
});

const taskResponse = (task) => ({
  id: task._id.toString(),
  bucketId: task.bucketId ? task.bucketId.toString() : null,
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  dueDate: task.dueDate,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});

const parseDateBoundary = (value, endOfDay = false) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
};

const getActiveTaskQuery = (extra = {}) => ({
  isDeleted: { $ne: true },
  deletedAt: { $exists: false },
  ...extra,
});

const applyTaskDateFilter = (query, { dateFrom, dateTo, dateField = "dueDate" }) => {
  const allowedDateFields = ["createdAt", "dueDate"];
  const filterDateField = allowedDateFields.includes(dateField) ? dateField : "dueDate";
  const startDate = parseDateBoundary(dateFrom);
  const endDate = parseDateBoundary(dateTo, true);

  if (startDate || endDate) {
    query[filterDateField] = {};
    if (startDate) query[filterDateField].$gte = startDate;
    if (endDate) query[filterDateField].$lte = endDate;
  }

  return {
    filterDateField,
    startDate,
    endDate,
  };
};

const ensureDefaultBucket = async (userId) => {
  let defaultBucket = await TaskBucket.findOne({ userId, isDefault: true });

  if (!defaultBucket) {
    defaultBucket = await TaskBucket.findOneAndUpdate(
      { userId, name: DEFAULT_BUCKET_NAME },
      { $setOnInsert: { userId, name: DEFAULT_BUCKET_NAME }, $set: { isDefault: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  await Task.updateMany(
    { userId, $or: [{ bucketId: { $exists: false } }, { bucketId: null }] },
    { $set: { bucketId: defaultBucket._id } }
  );

  return defaultBucket;
};

module.exports = {
  DEFAULT_BUCKET_NAME,
  bucketResponse,
  ensureDefaultBucket,
  escapeRegex,
  applyTaskDateFilter,
  getActiveTaskQuery,
  isValidObjectId,
  parseDateBoundary,
  taskResponse,
  // Transition any tasks with status 'future' whose dueDate <= now to 'todo'
  transitionFutureTasksToTodoIfDue: async ({ userId } = {}) => {
    try {
      const query = { status: "future", dueDate: { $exists: true, $ne: null } };
      if (userId) query.userId = userId;

      const now = new Date();
      // Use UTC comparison — update tasks with dueDate <= now
      query.dueDate.$lte = now;

      const tasksToUpdate = await Task.find(query).select("_id status title userId dueDate");
      if (!tasksToUpdate.length) return { updated: 0 };

      const ids = tasksToUpdate.map((t) => t._id);
      await Task.updateMany({ _id: { $in: ids } }, { $set: { status: "todo" } });

      // Log transitions
      tasksToUpdate.forEach((t) => {
        // eslint-disable-next-line no-console
        console.log(`[Future->Todo] task=${t._id} title="${t.title}" userId=${t.userId} dueDate=${t.dueDate.toISOString()} at=${new Date().toISOString()}`);
      });

      return { updated: ids.length, ids };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error transitioning future tasks:", err);
      return { updated: 0, error: String(err) };
    }
  },
};
