const express = require("express");
const router = express.Router();
const {
  loginSupport,
  requireSupportAuth,
  forgotSupportPassword,
  verifySupportResetCode,
  resetSupportPassword,
} = require("../controllers/support/supportAuth");
const dashboard = require("../controllers/support/supportDashboard");

// Public
router.post("/login", loginSupport);
router.post("/forgot-password", forgotSupportPassword);
router.post("/verify-reset-code", verifySupportResetCode);
router.post("/reset-password", resetSupportPassword);

// Protected support endpoints
router.get("/dashboard/summary", requireSupportAuth, dashboard.getSummary);
router.get("/dashboard/logs", requireSupportAuth, dashboard.getLogs);
router.get("/dashboard/activity", requireSupportAuth, dashboard.getActivityLogs);
router.post("/dashboard/retry", requireSupportAuth, dashboard.retryEmail);
router.post("/dashboard/retry-all", requireSupportAuth, dashboard.retryAll);

module.exports = router;