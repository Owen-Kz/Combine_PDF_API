const fs = require("fs");
const path = require("path");
const emailErrorLogger = require("../utils/emailErrorLogger");
const { LogAction } = require("../../Logger");

const PROCESS_LOG_PATH = path.join(__dirname, "..", "..", "process_logs.txt");

const tailLines = (filePath, count = 50) => {
    try {
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n").filter(Boolean);
        return lines.slice(-count);
    } catch (_) {
        return [];
    }
};

const parseLogLine = (line) => {
    const match = line.match(/^\[([^\]]*)\]\s*\[([^\]]*)\]\s*(.*)$/);
    if (!match) return { raw: line, timestamp: null, level: "INFO", message: line };
    return { raw: line, timestamp: match[1], level: match[2], message: match[3] };
};

const getSummary = async (_req, res) => {
    try {
        const summary = await emailErrorLogger.getEmailErrorSummary();
        const recentLogs = tailLines(PROCESS_LOG_PATH, 20).map(parseLogLine).reverse();
        return res.json({ status: "success", summary, recentLogs });
    } catch (error) {
        LogAction(`Support dashboard summary error: ${error.message}`, "ERROR");
        return res.status(500).json({ status: "error", message: "Failed to load dashboard summary" });
    }
};

const getLogs = async (req, res) => {
    try {
        const { status = null, limit = 50, offset = 0 } = req.query || {};
        const data = await emailErrorLogger.getEmailErrorLogs({
            status: status || null,
            limit: Number(limit),
            offset: Number(offset),
        });
        return res.json({ status: "success", ...data });
    } catch (error) {
        LogAction(`Support dashboard logs error: ${error.message}`, "ERROR");
        return res.status(500).json({ status: "error", message: "Failed to load logs" });
    }
};

const getActivityLogs = async (req, res) => {
    try {
        const { limit = 80 } = req.query || {};
        const rawLines = tailLines(PROCESS_LOG_PATH, Number(limit)).reverse();
        const logs = rawLines.map(parseLogLine);
        return res.json({ status: "success", logs });
    } catch (error) {
        LogAction(`Support dashboard activity logs error: ${error.message}`, "ERROR");
        return res.status(500).json({ status: "error", message: "Failed to load activity logs" });
    }
};

const retryEmail = async (req, res) => {
    try {
        const { id } = req.body || {};
        if (!id && id !== 0) {
            return res.status(400).json({ status: "error", message: "Missing email error log id" });
        }
        const result = await emailErrorLogger.manualRetryEmail(Number(id));
        if (!result.found) {
            return res.status(404).json({ status: "error", message: "Email error log not found" });
        }
        LogAction(`Support manual retry: email error log id ${id} → ${result.status} by ${req.supportUser?.email || "unknown"}`);
        return res.json({ status: "success", result });
    } catch (error) {
        LogAction(`Support manual retry error: ${error.message}`, "ERROR");
        return res.status(500).json({ status: "error", message: "Retry failed" });
    }
};

const retryAll = async (_req, res) => {
    try {
        const result = await emailErrorLogger.manualRetryAll();
        LogAction(`Support manual retry-all: attempted=${result.attempted}, sent=${result.sent}, dead=${result.dead}`);
        return res.json({ status: "success", result });
    } catch (error) {
        LogAction(`Support manual retry-all error: ${error.message}`, "ERROR");
        return res.status(500).json({ status: "error", message: "Retry-all failed" });
    }
};

module.exports = { getSummary, getLogs, getActivityLogs, retryEmail, retryAll };