const db = require("../routes/db.config");
const multer = require("multer");
const SendNewSubmissionEmail = require("./utils/sendNewSubmissionEmail");
const sendEmailToHandler = require("./utils/SendHandlerEmail");
const CoAuthors = require("./CoAuthors");
const dbPromise = require("../routes/dbPromise.config");
const upload = multer();

const SubmitDisclosures = async (req, res) => {
    upload.none()(req, res, async (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({ 
                status: "error", 
                error: "Invalid form data format" 
            });
        }

        try {
              if(!req.user || !req.user.id){
            return res.json({error:"Session is Not Valid, please login again"})
        }
            const { manuscript_id, review_status, current_process } = req.body;
            const articleId = req.session.articleId;
            
            if (!articleId) {
                return res.status(400).json({ 
                    error: "No active manuscript session" 
                });
            }

            // Get manuscript data
            const [paper] = await dbPromise.query(
                "SELECT * FROM submissions WHERE revision_id = ?", 
                [articleId]
            );

            if (!paper || paper.length === 0) {
                return res.status(404).json({ 
                    error: "Paper not found" 
                });
            }

            const manuscript = paper[0];
            const { corresponding_authors_email, title } = manuscript;

            // Validate manuscript file exists
            if (!manuscript.manuscript_file) {
                return res.status(400).json({ 
                    error: "Upload a manuscript file to continue" 
                });
            }

            // Update submission status
            const [updateResult] = await dbPromise.query(
                "UPDATE submissions SET status = ? WHERE revision_id = ?",
                [review_status, articleId]
            );

            if (updateResult.affectedRows === 0) {
                return res.status(404).json({ 
                    error: "Manuscript could not be updated" 
                });
            }

            // Handle submission workflow
            if (review_status === "submitted") {
                // Send notifications
                const userFullname = `${req.user.prefix} ${req.user.firstname} ${req.user.lastname} ${req.user.othername}`
                await Promise.all([
                    SendNewSubmissionEmail(corresponding_authors_email, title, articleId),
                    sendEmailToHandler("submissions@asfirj.org", title, articleId, userFullname),
                    CoAuthors(req, res, articleId)
                ]);

                // Update previous versions
                const updatedStatus = current_process.replace('saved', 'submitted');
                await dbPromise.query(
                    "UPDATE submissions SET status = ? WHERE article_id = ? AND revision_id != ?",
                    [updatedStatus, manuscript_id, articleId]
                );

                // Clear session data instead of cookies
                req.session.manuscriptData = null;
                req.session.article_data = null 
                req.session.articleId = null

                return res.json({ 
                    success: true,
                    message: "Manuscript submitted successfully",
                    manuscriptId: articleId
                });
            }

            return res.json({ 
                success: true,
                message: "Manuscript saved successfully",
                manuscriptId: articleId
            });

        } catch (error) {
            console.error("Submission processing error:", error);
            return res.status(500).json({ 
                status: "error", 
                error: "Failed to process submission",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });
};

module.exports = SubmitDisclosures;