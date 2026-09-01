// controllers/editors/management/deleteEditorAccount.js
// Permanently removes an editor account from the editors table and, when a
// matching authors_account row exists, clears its is_editor flag.
const dbPromise = require("../../../routes/dbPromise.config");

const deleteEditorAccount = async (req, res) => {
  let connection;
  try {
    const { editorId } = req.body;

    if (!editorId) {
      return res.status(400).json({ status: "error", message: "Missing editor id" });
    }

    const [existing] = await dbPromise.query(
      "SELECT id, email, editorial_level FROM editors WHERE id = ?",
      [editorId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ status: "error", message: "Editor not found" });
    }

    const editor = existing[0];

    if (req.user && req.user.email === editor.email) {
      return res.status(400).json({
        status: "error",
        message: "You cannot delete your own account"
      });
    }

    if (
      editor.editorial_level === "admin" ||
      editor.editorial_level === "editor_in_chief"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Admin and Editor-in-Chief accounts cannot be deleted"
      });
    }

    connection = await dbPromise.getConnection();
    await connection.beginTransaction();

    await connection.query("DELETE FROM editors WHERE id = ?", [editorId]);

    await connection.query(
      "UPDATE editors_session SET expires_at = NOW() WHERE editor_id = ?",
      [editor.email]
    );

    const [authorRows] = await connection.query(
      "SELECT id FROM authors_account WHERE email = ?",
      [editor.email]
    );

    if (authorRows.length > 0) {
      await connection.query(
        "UPDATE authors_account SET is_editor = 'no' WHERE email = ?",
        [editor.email]
      );
    }

    await connection.commit();

    return res.json({
      status: "success",
      message: "Editor account deleted",
      editor: { id: editorId, email: editor.email }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error deleting editor account:", error);
    return res.status(500).json({
      status: "error",
      message: process.env.NODE_ENV === "development" ? error.message : "Failed to delete editor account"
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = deleteEditorAccount;