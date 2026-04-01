// backend/controllers/author/submitCorrection.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto")

const RandomString = crypto.randomBytes(10).toString('hex');

const SendNewSubmissionEmail = require("../utils/sendNewSubmissionEmail");
const sendEmailToHandler = require("../utils/SendHandlerEmail");
const generateArticleId = require("../generateArticleId");
const CoAuthors = require("../CoAuthors");
const dbPromise = require("../../routes/dbPromise.config");
const { LogAction } = require("../../Logger");


// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../../useruploads/manuscripts');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const { manuscriptId, action } = req.body;
        const uniqueSuffix = Date.now() + '-' + RandomString;
        const fileExt = path.extname(file.originalname);

        // Sanitize original filename
        const sanitizedName = file.originalname
            .replace(/[^a-zA-Z0-9.]/g, '_')
            .replace(/\.[^/.]+$/, ''); // Remove extension

        // Determine file prefix based on action
        let prefix = '';
        if (action === 'correction' || action === "correction_saved" || action === "correction_submitted") prefix = 'CORR_';
        else if (action === 'revision' || action === "revision_saved" || action === "revision_submitted") prefix = 'REV_';
        else prefix = 'NEW_';

        // Include original filename in the saved file name for reference
        const fileName = `${prefix}${manuscriptId || 'draft'}_${sanitizedName}_${uniqueSuffix}${fileExt}`;
        cb(null, fileName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, Word, Excel, and images are allowed.'));
        }
    }
});

const submitCorrection = async (req, res) => {
    let connection;

    try {
        LogAction("Received submission data:", req.body);
        LogAction("Received files:", req.files);

        // Handle file uploads
        await new Promise((resolve, reject) => {
            upload.fields([
                { name: 'manuscript_file', maxCount: 1 },
                { name: 'coverLetter_file', maxCount: 1 },
                { name: 'tables_file', maxCount: 1 },
                { name: 'figures_file', maxCount: 1 },
                { name: 'supplementary_file', maxCount: 1 },
                { name: 'graphicAbstract_file', maxCount: 1 },
                { name: 'trackedManuscript_file', maxCount: 1 }
            ])(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const userEmail = req.user.email;
        const userFullname = req.user.fullname || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

        const {
            articleType,
            discipline,
            specialIssue,
            previousSubmission,
            previousId,
            title,
            abstract,
            keywords,
            authors,
            reviewers,
            disclosures,
            manuscriptId,
            action,
            isWomenInScience
        } = req.body;

        // Parse JSON strings
        let parsedKeywords = [];
        let parsedAuthors = [];
        let parsedReviewers = [];
        let parsedDisclosures = {};

        try {
            if (keywords) parsedKeywords = JSON.parse(keywords);
            if (authors) parsedAuthors = JSON.parse(authors);
            if (reviewers) parsedReviewers = JSON.parse(reviewers);
            if (disclosures) parsedDisclosures = JSON.parse(disclosures);
        } catch (e) {
            console.error("Error parsing JSON fields:", e);
        }

        if (!userEmail) {
            return res.status(401).json({
                status: "error",
                message: "User not authenticated"
            });
        }

        connection = await dbPromise.getConnection();
        await connection.beginTransaction();

        // Generate or use provided manuscript ID
        let finalManuscriptId = manuscriptId;
        console.log("Initial manuscript ID:", manuscriptId, "Action:", action, "Previous ID:", previousId);
        if (!finalManuscriptId || action === 'new') {
            // Generate new ID using the generateArticleId function
            finalManuscriptId = await generateArticleId({
                user: req.user,
                query: {
                    correct: action === 'correction_saved' || action === 'correction_submitted' || action === "correction" ? 'true' : undefined,
                    revise: action === 'revision_saved' || action === 'revision_submitted' || action === 'revision' ? 'true' : undefined,
                    a: previousId
                }
            });
        }
        console.log("Final manuscript ID to be used:", finalManuscriptId);

        // Process file uploads and generate URLs
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        const getFileUrl = (file) => {
            return file ? `${baseUrl}/useruploads/manuscripts/${file.filename}` : null;
        };

        const manuscriptFile = req.files?.manuscript_file?.[0]
            ? getFileUrl(req.files.manuscript_file[0])
            : null;

        const coverLetterFile = req.files?.coverLetter_file?.[0]
            ? getFileUrl(req.files.coverLetter_file[0])
            : null;

        const tablesFile = req.files?.tables_file?.[0]
            ? getFileUrl(req.files.tables_file[0])
            : null;

        const figuresFile = req.files?.figures_file?.[0]
            ? getFileUrl(req.files.figures_file[0])
            : null;

        const supplementaryFile = req.files?.supplementary_file?.[0]
            ? getFileUrl(req.files.supplementary_file[0])
            : null;

        const graphicAbstractFile = req.files?.graphicAbstract_file?.[0]
            ? getFileUrl(req.files.graphicAbstract_file[0])
            : null;

        const trackedManuscriptFile = req.files?.trackedManuscript_file?.[0]
            ? getFileUrl(req.files.trackedManuscript_file[0])
            : null;

        // Check if submission already exists
        const [existingSubmission] = await connection.query(
            `SELECT id FROM submissions WHERE revision_id = ?`,
            [finalManuscriptId]
        );

        // Get existing files if any (to preserve them if not overwritten)
        let existingFiles = {};
        if (existingSubmission.length > 0) {
            const [subData] = await connection.query(
                `SELECT manuscript_file, cover_letter_file, tables, figures, 
                        supplementary_material, graphic_abstract, tracked_manuscript_file 
                 FROM submissions WHERE revision_id = ?`,
                [finalManuscriptId]
            );
            if (subData.length > 0) {
                existingFiles = subData[0];
            }
        }

        const submissionData = {
            article_type: articleType || null,
            discipline: discipline || null,
            title: title || null,
            abstract: abstract || null,
            manuscript_file: manuscriptFile || existingFiles.manuscript_file || null,
            cover_letter_file: coverLetterFile || existingFiles.cover_letter_file || null,
            tables: tablesFile || existingFiles.tables || null,
            figures: figuresFile || existingFiles.figures || null,
            supplementary_material: supplementaryFile || existingFiles.supplementary_material || null,
            graphic_abstract: graphicAbstractFile || existingFiles.graphic_abstract || null,
            tracked_manuscript_file: trackedManuscriptFile || existingFiles.tracked_manuscript_file || null,
            corresponding_authors_email: userEmail,
            article_id: finalManuscriptId,
            revision_id: finalManuscriptId,
            previous_manuscript_id: previousId || null,
            status: action === 'submit' || action === "revision_submitted" || action === "correction_submitted" ? 'submitted' : 'draft',
            is_women_in_contemporary_science: isWomenInScience === 'yes' ? 1 : 0,
            last_updated: new Date()
        };

        let result;
        if (existingSubmission.length > 0) {
            // Update existing submission
            [result] = await connection.query(
                `UPDATE submissions SET ? WHERE revision_id = ?`,
                [submissionData, finalManuscriptId]
            );
            if (action === 'revision_submitted' || action === "revision_saved" || action === "correction_saved" || action === "correcion_submitted" || action === "correction" || action === "correction_saved") {
                await connection.query(
                    `UPDATE submissions SET status = ? WHERE article_id = ? OR previous_manuscript_id = ?`,
                    [action, submissionData.previous_manuscript_id, submissionData.previous_manuscript_id]
                );
                LogAction(`${action} updated for ${submissionData.previous_manuscript_id}. ${submissionData}`)
            }

            // Delete existing keywords
            await connection.query(
                `DELETE FROM submission_keywords WHERE article_id = ?`,
                [finalManuscriptId]
            );

            // Delete existing authors
            await connection.query(
                `DELETE FROM submission_authors WHERE submission_id = ?`,
                [finalManuscriptId]
            );

            // Delete existing reviewers
            await connection.query(
                `DELETE FROM suggested_reviewers WHERE article_id = ?`,
                [finalManuscriptId]
            );
        } else {
            // Insert new submission
            [result] = await connection.query(
                `INSERT INTO submissions SET ?`,
                [submissionData]
            );
        }

        // Insert keywords
        if (parsedKeywords && parsedKeywords.length > 0) {
            const keywordValues = parsedKeywords
                .filter(k => k && typeof k === 'string' && k.trim() !== '')
                .map(keyword => [finalManuscriptId, keyword.trim()]);

            if (keywordValues.length > 0) {
                await connection.query(
                    `INSERT INTO submission_keywords (article_id, keyword) VALUES ?`,
                    [keywordValues]
                );
            }
        }

        // Insert authors
        if (parsedAuthors && parsedAuthors.length > 0) {
            const authorValues = parsedAuthors.map(author => [
                finalManuscriptId,
                author.fullName || `${author.prefix || ''} ${author.firstName || ''} ${author.lastName || ''}`.trim(),
                author.email,
                author.orcid || author.orcid_id || null,
                author.asfiMembershipId || author.asfi_membership_id || null,
                author.affiliation || author.affiliations || null,
                author.country || author.affiliation_country || null,
                author.city || author.affiliation_city || null
            ]);

            await connection.query(
                `INSERT INTO submission_authors 
                 (submission_id, authors_fullname, authors_email, orcid_id, asfi_membership_id, 
                  affiliations, affiliation_country, affiliation_city) 
                 VALUES ?`,
                [authorValues]
            );
        }

        // Insert suggested reviewers
        if (parsedReviewers && parsedReviewers.length > 0) {
            const reviewerValues = parsedReviewers.map(reviewer => [
                finalManuscriptId,
                reviewer.fullName || `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim(),
                reviewer.email,
                reviewer.affiliation || null,
                reviewer.country || null,
                reviewer.city || null
            ]);

            await connection.query(
                `INSERT INTO suggested_reviewers 
                 (article_id, fullname, email, affiliation, affiliation_country, affiliation_city) 
                 VALUES ?`,
                [reviewerValues]
            );
        }

        await connection.commit();
        console.log("ACTION", action)
        // Send emails only if this is a final submission (not draft)
        if (action === 'submit' || action === 'correction_submitted' || action === 'revision_submitted') {
            try {
               const actionMessage = action === "submit" ? "" : action === "revision_submitted" ? "revision for" : action === "correction_submitted" ? "correction for" : ""
                const emailResults = await Promise.allSettled([
                    SendNewSubmissionEmail(userEmail, title, finalManuscriptId, actionMessage),
                    sendEmailToHandler("submissions@asfirj.org", title, finalManuscriptId, userFullname),
                    CoAuthors(req, res, finalManuscriptId)
                ]);

                LogAction('Email results:', emailResults);
            } catch (emailError) {
                console.error('Error sending emails:', emailError);
                // Don't fail the submission if emails fail
            }
        }
        const responseMessage = action === "submit" ? "Manuscript" : action === "correction_submitted" || action === "correction_saved" || action === "correction" ? "Manuscript Correction" : action === "revision_saved" || action === "revision_submitted" || action === "revision" ? "Manuscript Revision" : ""
        return res.json({
            status: "success",
            message: action === 'submit' || action === "revision_submitted" || action === "correction_submitted"
                ? `${responseMessage} submitted successfully`
                : `${responseMessage} saved as draft`,
            manuscriptId: finalManuscriptId
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error submitting manuscript:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal server error",
            ...(process.env.NODE_ENV === "development" && {
                error: error.message,
                stack: error.stack
            })
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = submitCorrection;