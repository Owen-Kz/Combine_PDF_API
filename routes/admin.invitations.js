const express = require("express");
const AuthorLoggedIn = require("../controllers/account/AuthorLoggedIn");
const { getAllInvitations, getInvitationStats,  getInvitationById, resendInvitation, cancelInvitation  } = require("../controllers/editors/admin/getInvitations");
const router = express.Router();
router.get("/invitations", AuthorLoggedIn, getAllInvitations);
router.get("/invitations/stats", AuthorLoggedIn, getInvitationStats);
router.get("/invitations/:id", AuthorLoggedIn, getInvitationById);
router.post("/invitations/:id/resend", AuthorLoggedIn, resendInvitation);
router.post("/invitations/:id/cancel", AuthorLoggedIn, cancelInvitation);

module.exports = router