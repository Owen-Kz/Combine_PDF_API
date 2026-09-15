// controllers/authors/submitManuscriptHandlers.js
//
// Split submission endpoints. The single monolithic submit-manuscript POST has
// been split into three focused handlers:
//
//   POST /submit-manuscript/draft        JSON only  -> persist metadata
//   POST /submit-manuscript/files        multipart  -> persist uploaded files
//   POST /submit-manuscript/finalize     JSON only  -> flip status + send emails
//
// The same handlers are reused for revisions and corrections — the `action`
// field in the request body drives the flow.
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const RandomString = crypto.randomBytes(10).toString('hex');

const SendNewSubmissionEmail = require("../utils/sendNewSubmissionEmail");
const sendEmailToHandler = require("../utils/SendHandlerEmail");
const generateArticleId = require("../generateArticleId");
const CoAuthors = require("../CoAuthors");
const dbPromise = require("../../routes/dbPromise.config");
const { LogAction } = require("../../Logger");

const FILE_FIELD_COLUMNS = {
    'manuscript_file': 'manuscript_file',
    'coverLetter_file': 'cover_letter_file',
    'tables_file': 'tables',
    'figures_file': 'figures',
    'supplementary_file': 'supplementary_material',
    'graphicAbstract_file': 'graphic_abstract',
    'trackedManuscript_file': 'tracked_manuscript_file'
};

// Helper function to determine file destination folder
function getFileDestination(fileFieldName) {
    const destinations = {
        'manuscript_file': 'manuscripts',
        'coverLetter_file': 'coverletters',
        'tables_file': 'tables',
        'figures_file': 'figures',
        'supplementary_file': 'supplementary',
        'graphicAbstract_file': 'graphicabstracts',
        'trackedManuscript_file': 'trackedmanuscripts'
    };
    return destinations[fileFieldName] || 'manuscripts';
}

// Helper function to get file suffix
function getFileSuffix(fileFieldName) {
    const suffixes = {
        'manuscript_file': '',
        'coverLetter_file': '_cover_letter',
        'tables_file': '_tables',
        'figures_file': '_figures',
        'supplementary_file': '_supplementary',
        'graphicAbstract_file': '_graphic_abstract',
        'trackedManuscript_file': '_tracked'
    };
    return suffixes[fileFieldName] || '';
}

// Configure multer for file uploads with dynamic destinations
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let fieldName = file.fieldname;
        const folderType = getFileDestination(fieldName);
        const uploadDir = path.join(__dirname, `../../useruploads/${folderType}`);

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const manuscriptId = req.body?.manuscriptId || req.query?.manuscriptId;
        const action = req.body?.action || 'new';
        const uniqueSuffix = Date.now() + '-' + RandomString;
        const fileExt = path.extname(file.originalname);

        let prefix = '';
        if (action === 'correction' || action === "correction_saved" || action === "correction_submitted") prefix = 'CORR_';
        else if (action === 'revision' || action === "revision_saved" || action === "revision_submitted") prefix = 'REV_';
        else prefix = 'NEW_';

        const suffix = getFileSuffix(file.fieldname);
        const fileName = `${prefix}${manuscriptId || 'draft'}${suffix}_${uniqueSuffix}${fileExt}`;
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

const handleUpload = upload.fields([
    { name: 'manuscript_file', maxCount: 1 },
    { name: 'coverLetter_file', maxCount: 1 },
    { name: 'tables_file', maxCount: 1 },
    { name: 'figures_file', maxCount: 1 },
    { name: 'supplementary_file', maxCount: 1 },
    { name: 'graphicAbstract_file', maxCount: 1 },
    { name: 'trackedManuscript_file', maxCount: 1 }
]);

// Fields may arrive as JSON strings (legacy multipart callers) or as native
// arrays/objects (new JSON callers). Normalize both.
const parseField = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (_) {
            return fallback;
        }
    }
    return value;
};

const getFileUrl = (file, fieldName, baseUrl) => {
    if (!file) return null;
    const folderType = getFileDestination(fieldName);
    return `${baseUrl}/useruploads/${folderType}/${file.filename}`;
};

/**
 * POST /submit-manuscript/draft
 *
 * JSON-only metadata save. Creates the submission row if needed (via
 * generateArticleId) and replaces keywords / authors / reviewers.
 */
const saveDraft = async (req, res) => {
    let connection;

    try {
        const userEmail = req.user?.email;
        if (!userEmail) {
            return res.status(401).json({ status: "error", message: "User not authenticated" });
        }

        const {
            articleType,
            discipline,
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
            isWomenInScience,
            isBelispointAcademic,
            isKidnappingForRansom,
        } = req.body || {};

        const parsedKeywords = parseField(keywords, []);
        const parsedAuthors = parseField(authors, []);
        const parsedReviewers = parseField(reviewers, []);
        const parsedDisclosures = parseField(disclosures, {});
        if (!Array.isArray(parsedKeywords)) return res.status(400).json({ status: "error", message: "keywords must be an array" });
        if (!Array.isArray(parsedAuthors)) return res.status(400).json({ status: "error", message: "authors must be an array" });
        if (!Array.isArray(parsedReviewers)) return res.status(400).json({ status: "error", message: "reviewers must be an array" });

        connection = await dbPromise.getConnection();
        await connection.beginTransaction();

        // Generate or use provided manuscript ID
        let finalManuscriptId = manuscriptId;
        if (!finalManuscriptId) {
            finalManuscriptId = await generateArticleId({
                user: req.user,
                query: {
                    correct: action === 'correction_saved' || action === 'correction' ? 'true' : undefined,
                    revise: action === 'revision_saved' || action === 'revision' ? 'true' : undefined,
                    a: previousId
                }
            });
        }

        // Check if submission already exists and capture its file URLs so a
        // metadata-only save never wipes previously uploaded files.
        const [existingSubmission] = await connection.query(
            `SELECT id FROM submissions WHERE revision_id = ?`,
            [finalManuscriptId]
        );
        const existingFiles = {};
        const existingFileColumns = [
            'manuscript_file', 'cover_letter_file', 'tables', 'figures',
            'supplementary_material', 'graphic_abstract', 'tracked_manuscript_file'
        ];
        if (existingSubmission.length > 0) {
            const [subData] = await connection.query(
                `SELECT ${existingFileColumns.join(', ')} FROM submissions WHERE revision_id = ?`,
                [finalManuscriptId]
            );
            if (subData.length > 0) Object.assign(existingFiles, subData[0]);
        }

        const submissionData = {
            article_type: articleType || null,
            discipline: discipline || null,
            title: title || null,
            abstract: abstract || null,
            manuscript_file: existingFiles.manuscript_file ?? null,
            cover_letter_file: existingFiles.cover_letter_file ?? null,
            tables: existingFiles.tables ?? null,
            figures: existingFiles.figures ?? null,
            supplementary_material: existingFiles.supplementary_material ?? null,
            graphic_abstract: existingFiles.graphic_abstract ?? null,
            tracked_manuscript_file: existingFiles.tracked_manuscript_file ?? null,
            corresponding_authors_email: userEmail,
            article_id: finalManuscriptId,
            revision_id: finalManuscriptId,
            previous_manuscript_id: previousId || null,
            status: 'draft',
            is_women_in_contemporary_science: isWomenInScience === 'yes' ? 1 : 0,
            is_belispoint_academic: isBelispointAcademic === 'yes' ? 1 : 0,
            is_kidnapping_for_ransom: isKidnappingForRansom === 'yes' ? 1 : 0,
            last_updated: new Date()
        };

        if (existingSubmission.length > 0) {
            await connection.query(
                `UPDATE submissions SET ? WHERE revision_id = ?`,
                [submissionData, finalManuscriptId]
            );

            // Replace keywords / authors / reviewers
            await connection.query(`DELETE FROM submission_keywords WHERE article_id = ?`, [finalManuscriptId]);
            await connection.query(`DELETE FROM submission_authors WHERE submission_id = ?`, [finalManuscriptId]);
            await connection.query(`DELETE FROM suggested_reviewers WHERE article_id = ?`, [finalManuscriptId]);
        } else {
            await connection.query(`INSERT INTO submissions SET ?`, [submissionData]);
        }

        if (parsedKeywords.length > 0) {
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

        if (parsedAuthors.length > 0) {
            const authorValues = parsedAuthors.map(author => [
                finalManuscriptId,
                author.fullName || `${author.prefix || ''} ${author.firstname || author.firstName || ''} ${author.lastname || author.lastName || ''}`.trim(),
                author.email,
                author.orcid_id || author.orcid || null,
                author.asfi_membership_id || null,
                author.affiliations || author.affiliation || null,
                author.affiliation_country || author.country || null,
                author.affiliation_city || author.city || null
            ]);
            await connection.query(
                `INSERT INTO submission_authors
                 (submission_id, authors_fullname, authors_email, orcid_id, asfi_membership_id,
                  affiliations, affiliation_country, affiliation_city)
                 VALUES ?`,
                [authorValues]
            );
        }

        if (parsedReviewers.length > 0) {
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
        LogAction(`Draft saved for ${finalManuscriptId} by ${userEmail} (action: ${action || 'draft'})`);

        return res.json({ status: "success", manuscriptId: finalManuscriptId });
    } catch (error) {
        if (connection) await connection.rollback();
        LogAction("Error saving manuscript draft:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error",
            ...(process.env.NODE_ENV === "development" && { error: error.message, stack: error.stack })
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * POST /submit-manuscript/files
 *
 * Multipart-only upload of manuscript / cover letter / figures / etc.
 * Updates the corresponding file columns on the submission row.
 */
const uploadFiles = async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            handleUpload(req, res, (err) => {
                if (err) {
                    LogAction("File upload error:", err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        const manuscriptId = req.body?.manuscriptId;
        if (!manuscriptId) {
            return res.status(400).json({ status: "error", message: "manuscriptId is required to upload files" });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const files = req.files || {};

        // Build column -> (newUrl | keepExisting) update pairs
        const updatePairs = [];
        const uploadedUrls = {};

        for (const [fieldName, column] of Object.entries(FILE_FIELD_COLUMNS)) {
            const file = files[fieldName]?.[0];
            if (file) {
                const url = getFileUrl(file, fieldName, baseUrl);
                updatePairs.push({ column, url });
                uploadedUrls[fieldName.replace('_file', '')] = url;
            } else {
                // Preserve any URL explicitly sent as {key}_url (existing files)
                const urlKey = `${fieldName.replace('_file', '')}_url`;
                if (req.body?.[urlKey]) {
                    updatePairs.push({ column, url: req.body[urlKey] });
                }
            }
        }

        if (updatePairs.length === 0) {
            return res.status(400).json({ status: "error", message: "No files were uploaded" });
        }

        let connection;
        try {
            connection = await dbPromise.getConnection();
            const [existing] = await connection.query(
                `SELECT id FROM submissions WHERE revision_id = ?`,
                [manuscriptId]
            );
            if (existing.length === 0) {
                return res.status(400).json({
                    status: "error",
                    message: "Draft must be saved before uploading files"
                });
            }

            for (const { column, url } of updatePairs) {
                await connection.query(
                    `UPDATE submissions SET ?? = ? WHERE revision_id = ?`,
                    [column, url, manuscriptId]
                );
            }
        } finally {
            if (connection) connection.release();
        }

        LogAction(`Files uploaded for ${manuscriptId}: ${Object.keys(uploadedUrls).join(', ') || 'preserved'}`);
        return res.json({ status: "success", manuscriptId, files: uploadedUrls });
    } catch (error) {
        LogAction("Error uploading manuscript files:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error",
            ...(process.env.NODE_ENV === "development" && { error: error.message, stack: error.stack })
        });
    }
};

/**
 * POST /submit-manuscript/finalize
 *
 * JSON-only. Flips the submission status to 'submitted', stamps date_submitted,
 * updates the original article for revisions/corrections, then fires the three
 * submission emails.
 */
const finalizeSubmission = async (req, res) => {
    let connection;

    try {
        const { manuscriptId, action } = req.body || {};
        if (!manuscriptId) {
            return res.status(400).json({ status: "error", message: "manuscriptId is required" });
        }

        const finalActions = ['submit', 'correction_submitted', 'revision_submitted'];
        if (!finalActions.includes(action)) {
            return res.status(400).json({ status: "error", message: `Invalid action "${action}".` });
        }

        connection = await dbPromise.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `SELECT * FROM submissions WHERE revision_id = ?`,
            [manuscriptId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: "error", message: "Submission not found" });
        }
        const submission = rows[0];

        if (submission.status === 'submitted') {
            await connection.commit();
            return res.json({ status: "success", message: "Manuscript already submitted", manuscriptId });
        }

        await connection.query(
            `UPDATE submissions SET status = 'submitted', date_submitted = ?, last_updated = ? WHERE revision_id = ?`,
            [new Date(), new Date(), manuscriptId]
        );

        let actionMessage = '';
        if (action === 'revision_submitted') {
            actionMessage = "revision for";
            await connection.query(
                `UPDATE submissions SET status = 'revision_submitted' WHERE article_id = ? OR previous_manuscript_id = ?`,
                [submission.previous_manuscript_id, submission.previous_manuscript_id]
            );
        } else if (action === 'correction_submitted') {
            actionMessage = "correction for";
            await connection.query(
                `UPDATE submissions SET status = 'correction_submitted' WHERE article_id = ? OR previous_manuscript_id = ?`,
                [submission.previous_manuscript_id, submission.previous_manuscript_id]
            );
        }

        await connection.commit();

        const userEmail = submission.corresponding_authors_email || req.user?.email;
        const userFullname = req.user?.fullname ||
            `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() ||
            submission.corresponding_author || '';
        const title = submission.title;

        // Emails are awaited but isolated — failures are logged, never returned.
        try {
            const emailResults = await Promise.allSettled([
                userEmail ? SendNewSubmissionEmail(userEmail, title, manuscriptId, actionMessage) : Promise.resolve(),
                sendEmailToHandler("submissions@asfirj.org", title, manuscriptId, userFullname),
                CoAuthors(req, res, manuscriptId)
            ]);
            LogAction('Email results for finalize:', emailResults.map(r => r.status));
        } catch (emailError) {
            LogAction('Error sending finalization emails:', emailError);
        }

        LogAction(`Manuscript finalized: ${manuscriptId} (action: ${action})`);

        return res.json({
            status: "success",
            message: action === 'submit'
                ? "Manuscript submitted successfully"
                : "Manuscript resubmitted successfully",
            manuscriptId
        });
    } catch (error) {
        if (connection) await connection.rollback();
        LogAction("Error finalizing manuscript:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error",
            ...(process.env.NODE_ENV === "development" && { error: error.message, stack: error.stack })
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { saveDraft, uploadFiles, finalizeSubmission };