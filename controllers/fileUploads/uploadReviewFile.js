// controllers/uploads/uploadReviewFile.js
require("dotenv").config();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const dbPromise = require("../../routes/dbPromise.config");

// ============================================
// FILE CONFIG
// ============================================
const FILE_CONFIG = {
    MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB — review attachments are usually small
    ALLOWED_MIME_TYPES: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
    ],
    VALID_FIELDS: [
        'paragraph_summary_file',
        'general_comment_file',
        'specific_comment_file',
    ],
};

// ============================================
// DESTINATION MAP
// ============================================
const DESTINATION_MAP = {
    review_files: {
        dir: 'review-files',
        url: '/useruploads/review-files'
    },
    misc: {
        dir: 'misc',
        url: '/useruploads/misc'
    }
};

const resolveDestination = (key) => {
    const normalized = (key || '').toString().trim().toLowerCase();
    return DESTINATION_MAP[normalized] || DESTINATION_MAP.review_files;
};

// Multer field name -> reviews table column
const FILE_FIELD_COLUMNS = {
    paragraph_summary_file: 'one_paragraph_file',
    general_comment_file: 'general_comment_file',
    specific_comment_file: 'specific_comment_file',
};

// Base useruploads directory — must match the `/useruploads` static mount in app.js
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'useruploads');

// ============================================
// HELPERS
// ============================================
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const sanitizeFilename = (name) => {
    const ext = path.extname(name).toLowerCase();
    const base = path.basename(name, ext)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 80);
    return { base: base || 'file', ext };
};

const buildFilename = (originalName, manuscriptId, field) => {
    const { base, ext } = sanitizeFilename(originalName);
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
    // Prefix with review context so files are self-identifying on disk
    return `Review_${manuscriptId}_${field}_${base}_${uniqueSuffix}${ext}`;
};

const cleanUpLocalFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (error) {
            console.warn('Failed to delete local file:', error.message);
        }
    }
};

const buildFileUrl = (destination, filename, fallbackDomain = '') => {
    const { url } = resolveDestination(destination);
    const domain = process.env.CURRENT_DOMAIN || fallbackDomain;
    return `${domain}${url}/${filename}`;
};

// ============================================
// MULTER — dynamic disk storage
// ============================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const destinationKey =
            req.body?.destination ||
            req.query?.destination ||
            req.headers['x-destination'] ||
            'review_files';

        const { dir } = resolveDestination(destinationKey);
        const uploadPath = path.join(UPLOADS_ROOT, dir);

        try {
            ensureDir(uploadPath);
            req._resolvedDestination = { ...resolveDestination(destinationKey), path: uploadPath };
            cb(null, uploadPath);
        } catch (err) {
            cb(err);
        }
    },
    filename: function (req, file, cb) {
        const manuscriptId = req.body?.manuscriptId || 'unknown';
        const field = file.fieldname || 'file';
        cb(null, buildFilename(file.originalname, manuscriptId, field));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: FILE_CONFIG.MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (FILE_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: PDF, Word, TXT`), false);
        }
    }
});

// ============================================
// MAIN HANDLER
// ============================================
const uploadReviewFile = async (req, res) => {
    const fileField = req.params.field;

    if (!FILE_CONFIG.VALID_FIELDS.includes(fileField)) {
        return res.status(400).json({
            status: 'error',
            message: "Invalid file field specified",
            validFields: FILE_CONFIG.VALID_FIELDS
        });
    }

    try {
        upload.single(fileField)(req, res, async (err) => {
            let localFilePath = req.file?.path;

            try {
                // ---- Multer errors ----
                if (err) {
                    cleanUpLocalFile(localFilePath);

                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(413).json({
                            status: 'error',
                            message: `File exceeds maximum size of ${FILE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
                        });
                    }
                    if (err.message.includes('Invalid file type')) {
                        return res.status(415).json({ status: 'error', message: err.message });
                    }
                    console.error('Upload error:', err);
                    return res.status(500).json({
                        status: 'error',
                        message: 'File upload failed',
                        ...(process.env.NODE_ENV === 'development' && { details: err.message })
                    });
                }

                if (!req.file) {
                    return res.status(400).json({ status: 'error', message: "No file uploaded" });
                }

                // ---- Identify the manuscript this review belongs to ----
                const manuscriptId =
                    req.body?.manuscriptId ||
                    req.query?.manuscriptId ||
                    req.body?.articleId ||
                    req.query?.articleId;

                if (!manuscriptId) {
                    cleanUpLocalFile(localFilePath);
                    return res.status(400).json({
                        status: 'error',
                        message: "Manuscript ID is required"
                    });
                }

                const userEmail = req.user?.email;
                if (!userEmail) {
                    cleanUpLocalFile(localFilePath);
                    return res.status(401).json({
                        status: 'error',
                        message: "Authentication required"
                    });
                }

                // ---- Build the public URL ----
                const destinationKey =
                    req.body?.destination ||
                    req.query?.destination ||
                    req.headers['x-destination'] ||
                    'review_files';

                const resolved = resolveDestination(destinationKey);
                const fileUrl = buildFileUrl(
                    destinationKey,
                    req.file.filename,
                    `${req.protocol}://${req.get('host')}`
                );

                console.log(
                    `Saved ${fileField} → ${resolved.dir}/${req.file.filename} for manuscript ${manuscriptId}`
                );

                // ---- Best-effort DB write so drafts pick up the URL immediately ----
                const column = FILE_FIELD_COLUMNS[fileField];
                let savedToDraft = false;
                try {
                    const [rows] = await dbPromise.query(
                        `SELECT id FROM reviews
                         WHERE article_id = ? AND reviewer_email = ?
                         LIMIT 1`,
                        [manuscriptId, userEmail]
                    );

                    if (rows.length > 0 && column) {
                        await dbPromise.query(
                            `UPDATE reviews SET ?? = ? WHERE article_id = ? AND reviewer_email = ?`,
                            [column, fileUrl, manuscriptId, userEmail]
                        );
                        savedToDraft = true;
                        console.log(`Review file ${fileField} saved to DB for ${manuscriptId}`);
                    } else {
                        console.log(
                            `Skipped DB write for ${fileField}: no review row yet for ${manuscriptId} — URL returned to client only`
                        );
                    }
                } catch (dbError) {
                    console.error("Database update failed (URL still returned to client):", dbError);
                }

                // ---- Respond ----
                return res.json({
                    status: 'success',
                    success: true,
                    fileUrl,
                    url: fileUrl, // alias for frontends that check either key
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
                    review: {
                        manuscriptId,
                        reviewerEmail: userEmail,
                    }
                });

            } catch (error) {
                cleanUpLocalFile(localFilePath);
                console.error("File processing error:", error);
                return res.status(500).json({
                    status: 'error',
                    message: "File processing failed",
                    ...(process.env.NODE_ENV === 'development' && { details: error.message })
                });
            }
        });
    } catch (error) {
        console.error("System error in review upload handler:", error);
        return res.status(500).json({
            status: 'error',
            message: "Internal server error",
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        });
    }
};

module.exports = uploadReviewFile;
module.exports.FILE_CONFIG = FILE_CONFIG;
module.exports.DESTINATION_MAP = DESTINATION_MAP;