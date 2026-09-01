// controllers/editors/management/updateEditorLevel.js
// Updates an editor's editorial_level (e.g. sectional_editor -> editorial_assistant).
const dbPromise = require("../../../routes/dbPromise.config");

const ALLOWED_LEVELS = [
  "sectional_editor",
  "editorial_assistant",
  "editor_in_chief",
  "associate_editor",
  "admin"
];

const updateEditorLevel = async (req, res) => {
  try {
    const { editorId, editorialLevel } = req.body;

    if (!editorId) {
      return res.status(400).json({ status: "error", message: "Missing editor id" });
    }

    if (!editorialLevel || !ALLOWED_LEVELS.includes(editorialLevel)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid editorial level"
      });
    }

    const [existing] = await dbPromise.query(
      "SELECT id, email, editorial_level FROM editors WHERE id = ?",
      [editorId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ status: "error", message: "Editor not found" });
    }

    const previousLevel = existing[0].editorial_level;

    await dbPromise.query(
      "UPDATE editors SET editorial_level = ? WHERE id = ?",
      [editorialLevel, editorId]
    );

    return res.json({
      status: "success",
      message: `Editor level updated from ${previousLevel} to ${editorialLevel}`,
      editor: { id: editorId, email: existing[0].email, editorialLevel }
    });
  } catch (error) {
    console.error("Error updating editor level:", error);
    return res.status(500).json({
      status: "error",
      message: process.env.NODE_ENV === "development" ? error.message : "Failed to update editor level"
    });
  }
};

module.exports = updateEditorLevel;