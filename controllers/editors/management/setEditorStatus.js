// controllers/editors/management/setEditorStatus.js
// Deactivates or reactivates an editor account (soft status toggle).
const dbPromise = require("../../../routes/dbPromise.config");

const setEditorStatus = async (req, res) => {
  try {
    const { editorId, status } = req.body;

    if (!editorId) {
      return res.status(400).json({ status: "error", message: "Missing editor id" });
    }

    if (!["active", "deactivated"].includes(status)) {
      return res.status(400).json({ status: "error", message: "Invalid status" });
    }

    const [existing] = await dbPromise.query(
      "SELECT id, email, editorial_level, status FROM editors WHERE id = ?",
      [editorId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ status: "error", message: "Editor not found" });
    }

    const editor = existing[0];

    if (req.user && req.user.email === editor.email) {
      return res.status(400).json({
        status: "error",
        message: "You cannot change the status of your own account"
      });
    }

    if (
      status === "deactivated" &&
      (editor.editorial_level === "admin" || editor.editorial_level === "editor_in_chief")
    ) {
      return res.status(400).json({
        status: "error",
        message: "Admin and Editor-in-Chief accounts cannot be deactivated"
      });
    }

    await dbPromise.query("UPDATE editors SET status = ? WHERE id = ?", [status, editorId]);

    if (status === "deactivated") {
      // Force the editor's active sessions to expire so they are logged out.
      await dbPromise.query(
        "UPDATE editors_session SET expires_at = NOW() WHERE editor_id = ?",
        [editor.email]
      );
    }

    return res.json({
      status: "success",
      message:
        status === "deactivated"
          ? "Editor account deactivated"
          : "Editor account reactivated",
      editor: { id: editorId, email: editor.email, status }
    });
  } catch (error) {
    console.error("Error setting editor status:", error);
    return res.status(500).json({
      status: "error",
      message: process.env.NODE_ENV === "development" ? error.message : "Failed to update editor status"
    });
  }
};

module.exports = setEditorStatus;