const cron = require("node-cron");
const { transitionFutureTasksToTodoIfDue } = require("../services/taskBuckets");

// Schedule daily at 00:01 UTC
cron.schedule(
  "1 0 * * *",
  async () => {
    try {
      // eslint-disable-next-line no-console
      console.log(`[Cron] Running future tasks transition at ${new Date().toISOString()}`);
      const result = await transitionFutureTasksToTodoIfDue();
      // eslint-disable-next-line no-console
      console.log(`[Cron] Future tasks transition result: ${JSON.stringify(result)}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Cron] Error running future tasks transition:", err);
    }
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
);

module.exports = {};
