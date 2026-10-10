// backend/controllers/authors/submitManuscriptHandlers.js
const SendNewSubmissionEmail = require("../utils/sendNewSubmissionEmail");
const sendEmailToHandler = require("../utils/SendHandlerEmail");
const generateArticleId = require("../generateArticleId");
const {
    hasDerivedSuffix,
    stripDerivedSuffix,
    isDerivedAction,
} = require("../utils/submissionIdUtils");
const CoAuthors = require("../CoAuthors");
const dbPromise = require("../../routes/dbPromise.config");
const { invalidateFamilyCache } = require("../editors/familyMap");
const { LogAction } = require("../../Logger");

const FILE_URL_COLUMNS = [
    'manuscript_file',
    'cover_letter_file',
    'tables',
    'figures',
    'supplementary_material',
    'graphic_abstract',
    'tracked_manuscript_file'
];

const WIZARD_FILE_COLUMNS = {
    manuscript: 'manuscript_file',
    coverLetter: 'cover_letter_file',
    tables: 'tables',
    figures: 'figures',
    supplementary: 'supplementary_material',
    graphicAbstract: 'graphic_abstract',
    trackedManuscript: 'tracked_manuscript_file'
};

const LEGACY_FILE_URL_KEYS = {
    manuscript_url: 'manuscript_file',
    coverLetter_url: 'cover_letter_file',
    tables_url: 'tables',
    figures_url: 'figures',
    supplementary_url: 'supplementary_material',
    graphicAbstract_url: 'graphic_abstract',
    trackedManuscript_url: 'tracked_manuscript_file'
};

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

const collectFileUrls = (body = {}) => {
    const urls = {};

    const files = parseField(body?.files, null);
    if (files && typeof files === 'object' && !Array.isArray(files)) {
        for (const [key, value] of Object.entries(files)) {
            const column = WIZARD_FILE_COLUMNS[key] ||
                (FILE_URL_COLUMNS.includes(key) ? key : null);
            if (column) urls[column] = value || null;
        }
    }

    for (const [legacyKey, column] of Object.entries(LEGACY_FILE_URL_KEYS)) {
        if (body?.[legacyKey] !== undefined) urls[column] = body[legacyKey] || null;
    }

    for (const column of FILE_URL_COLUMNS) {
        if (body?.[column] !== undefined) urls[column] = body[column] || null;
    }

    return urls;
};

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

        const providedFiles = collectFileUrls(req.body || {});

        const parsedKeywords = parseField(keywords, []);
        const parsedAuthors = parseField(authors, []);
        const parsedReviewers = parseField(reviewers, []);
        const parsedDisclosures = parseField(disclosures, {});
        if (!Array.isArray(parsedKeywords)) return res.status(400).json({ status: "error", message: "keywords must be an array" });
        if (!Array.isArray(parsedAuthors)) return res.status(400).json({ status: "error", message: "authors must be an array" });
        if (!Array.isArray(parsedReviewers)) return res.status(400).json({ status: "error", message: "reviewers must be an array" });

        connection = await dbPromise.getConnection();
        await connection.beginTransaction();

        const derived = isDerivedAction(action);
        let finalManuscriptId = manuscriptId;
        if (!finalManuscriptId || (derived && !hasDerivedSuffix(finalManuscriptId))) {
            finalManuscriptId = await generateArticleId({
                user: req.user,
                query: {
                    correct: action === 'correction_saved' || action === 'correction' || action === 'correction_submitted' ? 'true' : undefined,
                    revise: action === 'revision_saved' || action === 'revision' || action === 'revision_submitted' ? 'true' : undefined,
                    a: previousId
                }
            });
        }

        const [existingSubmission] = await connection.query(
            `SELECT id, article_id FROM submissions WHERE revision_id = ?`,
            [finalManuscriptId]
        );
        const existingFiles = {};
        if (existingSubmission.length > 0) {
            await connection.query(
                `UPDATE submissions SET status = ? WHERE previous_manuscript_id = ? AND revision_id != ?`,
                ['revision_started', existingSubmission[0].article_id, finalManuscriptId]
            );
            const [subData] = await connection.query(
                `SELECT ${FILE_URL_COLUMNS.join(', ')} FROM submissions WHERE revision_id = ?`,
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
            article_id: existingSubmission[0]?.article_id || (derived ? stripDerivedSuffix(finalManuscriptId) : finalManuscriptId),
            revision_id: finalManuscriptId,
            previous_manuscript_id: previousId || null,
            status: action,
            is_women_in_contemporary_science: isWomenInScience === 'yes' ? 1 : 0,
            is_belispoint_academic: isBelispointAcademic === 'yes' ? 1 : 0,
            is_kidnapping_for_ransom: isKidnappingForRansom === 'yes' ? 1 : 0,
            last_updated: new Date()
        };

        Object.assign(submissionData, providedFiles);

        if (existingSubmission.length > 0) {
            await connection.query(
                `UPDATE submissions SET ? WHERE revision_id = ?`,
                [submissionData, finalManuscriptId]
            );

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
        invalidateFamilyCache();
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

const uploadFiles = async (req, res) => {
    try {
        const manuscriptId = req.body?.manuscriptId || req.query?.manuscriptId;
        if (!manuscriptId) {
            return res.status(400).json({ status: "error", message: "manuscriptId is required to attach files" });
        }

        const fileUrls = collectFileUrls(req.body || {});
        const columns = Object.keys(fileUrls);
        if (columns.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "No file URLs were provided. Upload each file to /submission/uploadSingleFile/:field first."
            });
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
                    message: "Draft must be saved before attaching files"
                });
            }

            for (const column of columns) {
                await connection.query(
                    `UPDATE submissions SET ?? = ?, last_updated = ? WHERE revision_id = ?`,
                    [column, fileUrls[column], new Date(), manuscriptId]
                );
            }
        } finally {
            if (connection) connection.release();
        }

        LogAction(`File URLs attached for ${manuscriptId}: ${columns.join(', ')}`);
        return res.json({ status: "success", manuscriptId, files: fileUrls });
    } catch (error) {
        LogAction("Error uploading manuscript files:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error",
            ...(process.env.NODE_ENV === "development" && { error: error.message, stack: error.stack })
        });
    }
};

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
            await connection.query(`UPDATE submissions SET revisions_count = revisions_count + 1 WHERE article_id = ? LIMIT 1`, [submission.previous_manuscript_id]);
        } else if (action === 'correction_submitted') {
            actionMessage = "correction for";
            await connection.query(
                `UPDATE submissions SET status = 'correction_submitted' WHERE article_id = ? OR previous_manuscript_id = ?`,
                [submission.previous_manuscript_id, submission.previous_manuscript_id]
            );
            await connection.query(`UPDATE submissions SET corrections_count = corrections_count + 1 WHERE article_id = ? LIMIT 1`, [submission.previous_manuscript_id]);
        }

        await connection.commit();
        invalidateFamilyCache();

        const userEmail = submission.corresponding_authors_email || req.user?.email;
        const userFullname = req.user?.fullname ||
            `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() ||
            submission.corresponding_author || '';
        const title = submission.title;

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