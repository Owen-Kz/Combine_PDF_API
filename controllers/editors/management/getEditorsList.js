// controllers/editors/management/getEditorsList.js
// Lists all editors with their editorial level, section and status.
const dbPromise = require("../../../routes/dbPromise.config");

const getEditorsList = async (req, res) => {
  try {
    const [rows] = await dbPromise.query(
      `SELECT id, email, fullname, editorial_level, editorial_section, status, created_at
       FROM editors
       ORDER BY created_at DESC, id DESC`
    );

    return res.json({
      status: "success",
      editors: rows
    });
  } catch (error) {
    console.error("Error listing editors:", error);
    return res.status(500).json({
      status: "error",
      message: process.env.NODE_ENV === "development" ? error.message : "Failed to list editors"
    });
  }
};

module.exports = getEditorsList;