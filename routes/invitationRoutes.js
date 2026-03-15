// routes/invitationRoutes.js
const express = require("express");
const router = express.Router();

const checkUser = require("../controllers/account/checkUser");
const getInvitationDetails = require("../controllers/account/invitations/getInvitationDetails");
const acceptReviewer = require("../controllers/account/invitations/reviewer/acceptReviewer");
const declineReviewer = require("../controllers/account/invitations/reviewer/declineReviewer");
const createReviewerAccount = require("../controllers/account/invitations/reviewer/createReviewerAccount");
const acceptEditor = require("../controllers/account/invitations/editor/acceptEditor");
const declineEditor = require("../controllers/account/invitations/editor/declineEditor");
const createEditorAccount = require("../controllers/account/invitations/editor/createEditorAccount");

// Public routes (no authentication required)
router.post("/invitation/check-user", checkUser);
router.post("/invitation/details", getInvitationDetails);
router.post("/invitation/reviewer/accept", acceptReviewer);
router.post("/invitation/reviewer/decline", declineReviewer);
router.post("/invitation/create-reviewer-account", createReviewerAccount);

// Editor invitation routes (similar pattern)
router.post("/invitation/editor/accept", acceptEditor);
router.post("/invitation/editor/decline", declineEditor);
router.post("/invitation/create-editor-account", createEditorAccount);

module.exports = router;