require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");
const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// File validation constants
const FILE_CONFIG = {
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_MIME_TYPES: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/zip',
        'application/x-zip-compressed'
    ],
    REQUIRED_FIELDS: ['manuscript_file'], // Manuscript is mandatory
    VALID_FIELDS: [
        'manuscript_file',
        'cover_letter_file',
        'tables',
        'figures',
        'graphic_abstract',
        'supplementary_material',
        'tracked_manuscript_file'
    ]
};

// Multer Configuration
const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: FILE_CONFIG.MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        if (FILE_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, Word, images, ZIP`), false);
        }
    }
});

// Enhanced retry function with exponential backoff and jitter
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            // Don't retry on client errors (4xx) except 408 (Timeout) and 429 (Too Many Requests)
            if (error.http_code >= 400 && error.http_code < 500 && 
                error.http_code !== 408 && error.http_code !== 429) {
                throw error;
            }
            
            console.log(`Operation attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                const jitter = delay * 0.1 * (Math.random() * 2 - 1);
                const totalDelay = Math.max(100, delay + jitter);
                
                console.log(`Waiting ${Math.round(totalDelay)}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }
    }
    
    throw lastError;
}

// Enhanced session management
const ensureSessionData = (req) => {
    if (!req.session.manuscriptData) {
        req.session.manuscriptData = {
            // File flags
            manFile: false,
            covFile: false,
            docFile: false,
            // File URLs
            manuscript_file: null,
            cover_letter_file: null,
            document_file: null,
            // Session management
            sessionID: null,
            process: 'new',
            hasNewFiles: false,
            // Timestamps
            lastUpdated: new Date().toISOString()
        };
    }
    return req.session.manuscriptData;
};

// Save session with error handling
const saveSession = async (req) => {
    return new Promise((resolve, reject) => {
        req.session.manuscriptData.lastUpdated = new Date().toISOString();
        req.session.save((err) => {
            if (err) {
                console.error('Session save failed:', err);
                reject(new Error('Failed to save session data'));
            } else {
                resolve();
            }
        });
    });
};

// Validate manuscript requirements
const validateManuscriptRequirements = (sessionData) => {
    const errors = [];
    
    // Check if manuscript file is uploaded
    if (!sessionData.manFile || !sessionData.manuscript_file) {
        errors.push('Manuscript file is required');
    }
    
    // Check if manuscript file URL is valid
    if (sessionData.manuscript_file && typeof sessionData.manuscript_file === 'object') {
        if (!sessionData.manuscript_file.url) {
            errors.push('Manuscript file URL is invalid');
        }
    }
    
    return errors;
};

// Database operation with transaction support
async function updateSubmissionDatabase(articleId, fieldName, fileUrl, maxRetries = 3) {
    return await retryWithBackoff(async () => {
        let connection;
        try {
            connection = await dbPromise.getConnection();
            await connection.beginTransaction();

            // First check if the submission exists
            const [existingRecords] = await connection.query(
                "SELECT revision_id, corresponding_authors_email FROM submissions WHERE revision_id = ?",
                [articleId]
            );

            if (existingRecords.length > 0) {
                // Update existing record
                const [updateResult] = await connection.query(
                    `UPDATE submissions SET ${fieldName} = ?, last_updated = NOW() 
                     WHERE revision_id = ?`,
                    [fileUrl, articleId]
                );

                if (updateResult.affectedRows === 0) {
                    throw new Error("No rows affected during update");
                }
            } else {
                // For new submissions, we need user email
                if (!req.user?.email) {
                    throw new Error("User email required for new submission");
                }
                
                // Insert new record with user email
                const [insertResult] = await connection.query(
                    `INSERT INTO submissions (revision_id, ${fieldName}, corresponding_authors_email, last_updated) 
                     VALUES (?, ?, ?, NOW())`,
                    [articleId, fileUrl, req.user.email]
                );

                if (insertResult.affectedRows === 0) {
                    throw new Error("No rows affected during insert");
                }
            }

            await connection.commit();
            return true;
            
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }, maxRetries, 500);
}

// Clean up local files safely
const cleanUpLocalFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (error) {
            console.warn('Failed to delete local file:', error.message);
        }
    }
};

// Upload to Cloudinary with enhanced error handling
const uploadToCloudinary = async (filePath, fieldName) => {
    return await retryWithBackoff(async () => {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: `asfirj/original/${fieldName}`,
            resource_type: "auto",
            timeout: 120000,
            chunk_size: 6000000,
            quality: 'auto',
            format: 'auto'
        });
        
        if (!result.secure_url) {
            throw new Error('Cloudinary upload failed - no URL returned');
        }
        
        return result;
    }, 3, 1000);
};

const uploadSingleFile = async (req, res) => {
    const FileField = req.params.field;

    // Validate field parameter
    if (!FILE_CONFIG.VALID_FIELDS.includes(FileField)) {
        return res.status(400).json({ 
            error: "Invalid file field specified",
            validFields: FILE_CONFIG.VALID_FIELDS
        });
    }

    try {
        // Handle file upload
        upload.single(FileField)(req, res, async (err) => {
            const sessionData = ensureSessionData(req);
            let localFilePath = req.file?.path;

            try {
                // Handle upload errors
                if (err) {
                    cleanUpLocalFile(localFilePath);
                    
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(413).json({ 
                            error: `File exceeds maximum size of ${FILE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB` 
                        });
                    }
                    
                    if (err.message.includes('Invalid file type')) {
                        return res.status(415).json({ 
                            error: err.message 
                        });
                    }
                    
                    console.error('Upload error:', err);
                    return res.status(500).json({ 
                        error: 'File upload failed',
                        message: process.env.NODE_ENV === 'development' ? err.message : 'Please try again'
                    });
                }

                // Check if file was uploaded
                if (!req.file) {
                    return res.status(400).json({ 
                        error: "No file uploaded" 
                    });
                }

                // Validate file properties
                if (!req.file.originalname || !req.file.mimetype) {
                    cleanUpLocalFile(localFilePath);
                    return res.status(400).json({ 
                        error: "Invalid file properties" 
                    });
                }

                let cloudinaryResult;
                try {
                    // Upload to Cloudinary
                    cloudinaryResult = await uploadToCloudinary(localFilePath, FileField);
                } catch (cloudinaryError) {
                    cleanUpLocalFile(localFilePath);
                    console.error("Cloudinary upload failed:", cloudinaryError);
                    
                    return res.status(500).json({ 
                        error: "File upload to cloud storage failed",
                        details: process.env.NODE_ENV === 'development' ? cloudinaryError.message : "Please try again later"
                    });
                } finally {
                    // Always clean up local file
                    cleanUpLocalFile(localFilePath);
                }

                // Update session data
                sessionData[FileField] = {
                    url: cloudinaryResult.secure_url,
                    public_id: cloudinaryResult.public_id,
                    originalname: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    uploaded: true,
                    timestamp: new Date().toISOString()
                };

                // Set specific flags for file types
                if (FileField === 'manuscript_file') {
                    sessionData.manFile = true;
                    console.log('Manuscript file uploaded successfully');
                } else if (FileField === 'cover_letter_file') {
                    sessionData.covFile = true;
                }
                
                sessionData.hasNewFiles = true;
                sessionData.lastUpdated = new Date().toISOString();

                // Update database
                const articleId = req.session.manuscriptData?.sessionID || req.session.articleId;
                if (!articleId) {
                    // If no article ID, save to session only and return success
                    await saveSession(req);
                    
                    return res.json({ 
                        success: true, 
                        fileUrl: cloudinaryResult.secure_url,
                        field: FileField,
                        message: "File uploaded successfully (saved to session)",
                        flags: {
                            manFile: FileField === 'manuscript_file',
                            covFile: FileField === 'cover_letter_file',
                            hasManuscript: sessionData.manFile
                        },
                        manuscriptStatus: sessionData.manFile ? 'COMPLETE' : 'REQUIRED'
                    });
                }

                try {
                    await updateSubmissionDatabase(articleId, FileField, cloudinaryResult.secure_url, 3);
                } catch (dbError) {
                    console.error("Database update failed:", dbError);
                    // Don't fail the upload if database update fails - file is already in session
                    console.warn("File uploaded but database update failed, saved to session only");
                }

                // Save session explicitly
                try {
                    await saveSession(req);
                } catch (sessionError) {
                    console.error("Session save failed:", sessionError);
                    return res.status(500).json({ 
                        error: "Failed to save session data",
                        fileUrl: cloudinaryResult.secure_url // Still return file URL
                    });
                }

                // Validate manuscript requirements after upload
                const requirementErrors = validateManuscriptRequirements(sessionData);
                const hasManuscript = sessionData.manFile && sessionData.manuscript_file;

                return res.json({ 
                    success: true, 
                    fileUrl: cloudinaryResult.secure_url,
                    field: FileField,
                    flags: {
                        manFile: FileField === 'manuscript_file',
                        covFile: FileField === 'cover_letter_file',
                        hasManuscript: hasManuscript
                    },
                    manuscriptStatus: hasManuscript ? 'COMPLETE' : 'REQUIRED',
                    requirements: {
                        manuscriptUploaded: hasManuscript,
                        errors: requirementErrors,
                        isReadyForSubmission: requirementErrors.length === 0
                    },
                    session: {
                        articleId: articleId,
                        hasSession: true,
                        lastUpdated: sessionData.lastUpdated
                    }
                });

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

// Export validation function for use in other modules
module.exports = uploadSingleFile;
module.exports.validateManuscriptRequirements = validateManuscriptRequirements;
module.exports.ensureSessionData = ensureSessionData;
module.exports.FILE_CONFIG = FILE_CONFIG;