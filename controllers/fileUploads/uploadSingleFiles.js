// controllers/uploads/uploadSingleFile.js
require("dotenv").config();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const SubmissionManager = require("../utils/SubmissionManager");
const dbPromise = require("../../routes/dbPromise.config");

// File validation constants
const FILE_CONFIG = {
    MAX_FILE_SIZE: 2000 * 1024 * 1024, // 2GB
    ALLOWED_MIME_TYPES: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/zip',
        'application/x-zip-compressed'
    ],
    REQUIRED_FIELDS: ['manuscript_file'],
    VALID_FIELDS: [
        'manuscript_file',
        'cover_letter_file',
        'tables',
        'figures',
        'graphic_abstract',
        'supplementary_material',
        'tracked_manuscript_file',
        'manuscriptCover'
    ],
};

// ============================================
// DESTINATION MAP
// Maps a `destination` param from the request to a subfolder under useruploads/
// and to a URL path prefix. Add/rename entries to match your structure.
// ============================================
const DESTINATION_MAP = {
    manuscripts: {
        dir: 'manuscripts',
        url: '/useruploads/manuscripts'
    },
    article_images: {
        dir: 'article_images',
        url: '/useruploads/article_images'
    },
    cover_letters: {
        dir: 'cover_letters',
        url: '/useruploads/cover_letters'
    },
    tables: {
        dir: 'tables',
        url: '/useruploads/tables'
    },
    figures: {
        dir: 'figures',
        url: '/useruploads/figures'
    },
    supplementary: {
        dir: 'supplementary',
        url: '/useruploads/supplementary'
    },
    tracked_manuscripts: {
        dir: 'tracked_manuscripts',
        url: '/useruploads/tracked_manuscripts'
    },
    graphic_abstracts: {
        dir: 'graphic_abstracts',
        url: '/useruploads/graphic_abstracts'
    },
    misc: {
        dir: 'misc',
        url: '/useruploads/misc'
    }
};

// Resolve a destination key to its dir + url. Falls back to `misc`.
const resolveDestination = (key) => {
    const normalized = (key || '').toString().trim().toLowerCase();
    return DESTINATION_MAP[normalized] || DESTINATION_MAP.misc;
};

// Multer field name -> submissions column. Fields that are accepted but have no
// column (e.g. manuscriptCover) are still stored, they just aren't linked to a row.
const FILE_FIELD_COLUMNS = {
    manuscript_file: 'manuscript_file',
    cover_letter_file: 'cover_letter_file',
    tables: 'tables',
    figures: 'figures',
    graphic_abstract: 'graphic_abstract',
    supplementary_material: 'supplementary_material',
    tracked_manuscript_file: 'tracked_manuscript_file'
};

// Row statuses that may still be edited by an in-progress upload. A file must never
// overwrite a manuscript that has already gone to the editorial office.
const EDITABLE_STATUSES = [
    'draft', 'saved', 'saved_for_later',
    'revision_draft', 'revision_saved', 'returned_for_revision',
    'correction_draft', 'correction_saved', 'returned_for_correction'
];

// Base useruploads directory — must match the `/useruploads` static mount in app.js
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'useruploads');

// Ensure a directory exists, creating it recursively if needed
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Sanitize a filename to prevent path traversal and weird characters
const sanitizeFilename = (name) => {
    const ext = path.extname(name).toLowerCase();
    const base = path.basename(name, ext)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 80);
    return { base: base || 'file', ext };
};

// Build the final unique filename
const buildFilename = (originalName) => {
    const { base, ext } = sanitizeFilename(originalName);
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
    return `${base}_${uniqueSuffix}${ext}`;
};

// ============================================
// Multer — dynamic disk storage
// The destination is read from req.body.destination (set via multipart form field)
// or from a custom header (x-destination) as a fallback.
// ============================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Read destination from form field, query, or header
        const destinationKey =
            req.body?.destination ||
            req.query?.destination ||
            req.headers['x-destination'] ||
            'misc';

        const { dir } = resolveDestination(destinationKey);
        const uploadPath = path.join(UPLOADS_ROOT, dir);

        try {
            ensureDir(uploadPath);
            // Stash the resolved destination on the request for the handler
            req._resolvedDestination = { ...resolveDestination(destinationKey), path: uploadPath };
            cb(null, uploadPath);
        } catch (err) {
            cb(err);
        }
    },
    filename: function (req, file, cb) {
        cb(null, buildFilename(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: FILE_CONFIG.MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (FILE_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, Word, images, ZIP`), false);
        }
    }
});

// Cleanup helper (only used on failure paths now)
const cleanUpLocalFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (error) {
            console.warn('Failed to delete local file:', error.message);
        }
    }
};

// Build the public URL for a saved file. Falls back to the request host when
// CURRENT_DOMAIN is not configured so the client always gets an absolute URL.
const buildFileUrl = (destination, filename, fallbackDomain = '') => {
    const { url } = resolveDestination(destination);
    const domain = process.env.CURRENT_DOMAIN || fallbackDomain;
    return `${domain}${url}/${filename}`;
};

// Validate manuscript requirements
const validateManuscriptRequirements = (submissionData) => {
    const errors = [];
    if (!submissionData.manuscript_file) {
        errors.push('Manuscript file is required');
    }
    return errors;
};

// ============================================
// Main upload handler
// ============================================
const uploadSingleFile = async (req, res) => {
    console.log("upload started")
    const fileField = req.params.field;

    if (!FILE_CONFIG.VALID_FIELDS.includes(fileField)) {
        return res.status(400).json({
            error: "Invalid file field specified",
            validFields: FILE_CONFIG.VALID_FIELDS
        });
    }

    try {
        upload.single(fileField)(req, res, async (err) => {
            let localFilePath = req.file?.path;

            try {
                // Handle multer errors
                if (err) {
                    cleanUpLocalFile(localFilePath);

                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(413).json({
                            error: `File exceeds maximum size of ${FILE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
                        });
                    }
                    if (err.message.includes('Invalid file type')) {
                        return res.status(415).json({ error: err.message });
                    }
                    console.error('Upload error:', err);
                    return res.status(500).json({
                        error: 'File upload failed',
                        message: process.env.NODE_ENV === 'development' ? err.message : 'Please try again'
                    });
                }

                if (!req.file) {
                    return res.status(400).json({ error: "No file uploaded" });
                }

                // Get the manuscript this upload belongs to. The portal wizard sends
                // `manuscriptId` in the body; legacy callers used `articleId` in the query.
                const articleId =
                    req.body?.manuscriptId ||
                    req.body?.articleId ||
                    req.query?.manuscriptId ||
                    req.query?.articleId ||
                    req.submissionData?.articleId ||
                    req.articleId;

                if (!articleId) {
                    cleanUpLocalFile(localFilePath);
                    return res.status(400).json({
                        error: "No active submission found",
                        message: "Please start a new submission or reload the page"
                    });
                }

                // Determine the destination used and build the URL
                const destinationKey =
                    req.body?.destination ||
                    req.query?.destination ||
                    req.headers['x-destination'] ||
                    'misc';

                const resolved = resolveDestination(destinationKey);
                const fileUrl = buildFileUrl(
                    destinationKey,
                    req.file.filename,
                    `${req.protocol}://${req.get('host')}`
                );

                console.log(
                    `Saved ${fileField} → ${resolved.dir}/${req.file.filename} for article ${articleId}`
                );

                // Link the URL to the draft row. This is best-effort: the wizard replays
                // every URL with its next draft save, so a row that does not exist yet
                // must not cost the author their upload.
                const column = FILE_FIELD_COLUMNS[fileField];
                let savedToDraft = false;
                try {
                    const userEmail = req.user?.email;
                    if (column && userEmail) {
                        const [rows] = await dbPromise.query(
                            `SELECT status FROM submissions
                             WHERE revision_id = ? AND corresponding_authors_email = ? LIMIT 1`,
                            [articleId, userEmail]
                        );

                        if (rows.length > 0 && EDITABLE_STATUSES.includes(rows[0].status)) {
                            await dbPromise.query(
                                `UPDATE submissions SET ?? = ?, last_updated = ? WHERE revision_id = ?`,
                                [column, fileUrl, new Date(), articleId]
                            );
                            savedToDraft = true;
                            console.log(`File ${fileField} saved to database for submission: ${articleId}`);
                        } else {
                            console.log(
                                `Skipped DB write for ${fileField}: ${articleId} is not an editable draft — URL returned to client only`
                            );
                        }
                    }
                } catch (dbError) {
                    console.error("Database update failed (URL still returned to client):", dbError);
                }

                // Fetch updated submission data
                let submissionData;
                try {
                    submissionData = await SubmissionManager.getSubmissionData(articleId, req.user.email);
                } catch (fetchError) {
                    console.error("Failed to fetch submission data:", fetchError);
                    submissionData = {};
                }

                const hasManuscript = !!submissionData.manuscript_file;
                const hasCoverLetter = !!submissionData.cover_letter_file;
                const requirementErrors = validateManuscriptRequirements(submissionData);

                const response = {
                    success: true,
                    fileUrl,
                    field: fileField,
                    destination: resolved.dir,
                    savedToDraft,
                    fileInfo: {
                        originalname: req.file.originalname,
                        storedname: req.file.filename,
                        mimetype: req.file.mimetype,
                        size: req.file.size,
                        uploaded: true,
                        timestamp: new Date().toISOString()
                    },
                    submission: {
                        articleId,
                        manuscriptUploaded: hasManuscript,
                        coverLetterUploaded: hasCoverLetter
                    },
                    requirements: {
                        manuscriptUploaded: hasManuscript,
                        coverLetterUploaded: hasCoverLetter,
                        errors: requirementErrors,
                        isReadyForSubmission: requirementErrors.length === 0
                    }
                };

                if (fileField === 'manuscript_file') {
                    response.manuscriptStatus = 'COMPLETE';
                }

                return res.json(response);

            } catch (error) {
                cleanUpLocalFile(localFilePath);
                console.error("File processing error:", error);
                return res.status(500).json({
                    error: "File processing failed",
                    details: process.env.NODE_ENV === 'development' ? error.message : "Please try again later"
                });
            }
        });
    } catch (error) {
        console.error("System error in upload handler:", error);
        return res.status(500).json({
            error: "Internal server error",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// Check upload status (unchanged behavior)
// ============================================
uploadSingleFile.checkUploadStatus = async (req, res) => {
    try {
        const articleId = req.articleId || req.query.articleId;
        if (!articleId) {
            return res.status(400).json({ success: false, error: "No article ID provided" });
        }

        const submission = await SubmissionManager.getSubmissionData(articleId, req.user.email);
        if (!submission) {
            return res.status(404).json({ success: false, error: "Submission not found" });
        }

        const uploadStatus = FILE_CONFIG.VALID_FIELDS.reduce((acc, field) => {
            acc[field] = {
                uploaded: !!submission[field],
                url: submission[field],
                required: FILE_CONFIG.REQUIRED_FIELDS.includes(field)
            };
            return acc;
        }, {});

        const allRequiredUploaded = FILE_CONFIG.REQUIRED_FIELDS.every(
            field => uploadStatus[field]?.uploaded
        );

        return res.json({
            success: true,
            data: uploadStatus,
            allRequiredUploaded,
            submission: {
                articleId: submission.revision_id,
                title: submission.title,
                status: submission.status
            }
        });
    } catch (error) {
        console.error("Upload status check error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to check upload status",
            message: error.message
        });
    }
};

module.exports = uploadSingleFile;
module.exports.validateManuscriptRequirements = validateManuscriptRequirements;
module.exports.FILE_CONFIG = FILE_CONFIG;
module.exports.DESTINATION_MAP = DESTINATION_MAP;