const express = require("express");
const { config } = require("dotenv");
const AuthorLoggedIn = require("../controllers/account/AuthorLoggedIn");
const getReviewerInvitations = require("../controllers/account/invitations/reviewer/inApp/getReviewerInvitations");
const acceptReviewerInvitation = require("../controllers/account/invitations/reviewer/inApp/acceptReviewerInvitation");
const declineReviewerInvitation = require("../controllers/account/invitations/reviewer/inApp/declineReviewerInvitation");
const getPendingReviews = require("../controllers/reviewers/getPendingReviews");
const getOverdueReviews = require("../controllers/reviewers/getOverdueReviews");
const getCompletedReviews = require("../controllers/reviewers/getCompletedReviews");
const submitReview = require("../controllers/reviewers/submitReviews");
const getReviewDraft = require("../controllers/reviewers/getReviewDraft");
const getReviewerStats = require("../controllers/reviewers/getReviewerStats");
const router = express.Router()
config()

router.use(AuthorLoggedIn)

// In-app Invitations Controls 
// Get invitations
router.get("/invitations", AuthorLoggedIn, getReviewerInvitations);
// Accept invitation
router.post("/invitations/accept", AuthorLoggedIn, acceptReviewerInvitation);
// Decline invitation
router.post("/invitations/decline", AuthorLoggedIn, declineReviewerInvitation);

router.get("/pending-reviews", getPendingReviews);
router.get("/completed-reviews", getCompletedReviews);
router.get("/overdue-reviews", getOverdueReviews);
router.get("/stats", getReviewerStats);



// Review submission endpoints
router.post("/submit-review", submitReview);
router.get("/review-draft/:manuscriptId", getReviewDraft);

module.exports = router