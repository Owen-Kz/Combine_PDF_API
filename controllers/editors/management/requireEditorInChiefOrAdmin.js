// controllers/editors/management/requireEditorInChiefOrAdmin.js
// Stricter role gate: only editors-in-chief and admins may manage editor
// profiles / publications / publishing / special issues / invitations.
const MANAGER_LEVELS = ["admin", "administrator", "editor_in_chief", "editorial_assistant", "editor-in-chief"];

const requireEditorInChiefOrAdmin = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      status: "error",
      message: "Authentication required"
    });
  }

  const level = user._editor.editorialLevel || user._editor.editorial_level;
  const isAllowed =
    user.isAdmin === true ||
    (level && MANAGER_LEVELS.includes(level));

  if (!isAllowed) {
    return res.status(403).json({
      status: "error",
      message: "This action is restricted to Editors-in-Chief and Administrators"
    });
  }

  next();
};

module.exports = requireEditorInChiefOrAdmin;