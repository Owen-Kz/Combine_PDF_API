// controllers/editors/management/requireEditorialManager.js
// Role gate for editor management endpoints: only editorial assistants,
// editors-in-chief and admins can manage editors.
const requireEditorialManager = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      status: "error",
      message: "Authentication required"
    });
  }
  console.log("user:", user);

  const isAllowed =
    user.isEditorialAssistant === true ||
    user.isEditorInChief === true ||
    user.isAdmin === true ||
    user.canAccessAdmin === true;

  if (!isAllowed) {
    return res.status(403).json({
      status: "error",
      message: "You do not have permission to manage editors"
    });
  }

  next();
};

module.exports = requireEditorialManager;