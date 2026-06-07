const { getDashboardCounts } = require("../../repository/dashboard/dashboard.repository");

async function getDashboardData(req, res, next) {
  try {
    const data = await getDashboardCounts();
    return res.json({
      message: "Dashboard loaded successfully",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getDashboardData };
