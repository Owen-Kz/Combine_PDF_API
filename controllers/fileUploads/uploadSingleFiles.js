require("dotenv").config();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

const SubmissionManager = require("../utils/SubmissionManager");
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

// Validate manuscript requirements
const validateManuscriptRequirements = (submissionData) => {
    const errors = [];
    
    // Check if manuscript file is uploaded
    if (!submissionData.manuscript_file) {
        errors.push('Manuscript file is required');
    }
    
    return errors;
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

                // Get article ID from request (set by middleware)
                const articleId = req.articleId || req.submissionData?.articleId;
                
                if (!articleId) {
                    return res.status(400).json({ 
                        error: "No active submission found",
                        message: "Please start a new submission or reload the page"
                    });
                }

                // Update database using SubmissionManager
                try {
                    await SubmissionManager.saveStepData(articleId, 'upload_manuscript', {
                        [FileField]: cloudinaryResult.secure_url,
                        corresponding_authors_email: req.user.email
                    });

                    console.log(`File ${FileField} saved to database for submission: ${articleId}`);

                } catch (dbError) {
                    console.error("Database update failed:", dbError);
                    return res.status(500).json({ 
                        error: "Failed to save file information to database",
                        details: process.env.NODE_ENV === 'development' ? dbError.message : "Please try again later",
                        fileUrl: cloudinaryResult.secure_url // Still return file URL for fallback
                    });
                }

                // Get updated submission data to check requirements
                let submissionData;
                try {
                    submissionData = await SubmissionManager.getSubmissionData(articleId, req.user.email);
                } catch (fetchError) {
                    console.error("Failed to fetch submission data:", fetchError);
                    submissionData = {};
                }

                // Validate manuscript requirements after upload
                const requirementErrors = validateManuscriptRequirements(submissionData);
                const hasManuscript = !!submissionData.manuscript_file;
                const hasCoverLetter = !!submissionData.cover_letter_file;

                // Prepare response
                const response = {
                    success: true, 
                    fileUrl: cloudinaryResult.secure_url,
                    field: FileField,
                    fileInfo: {
                        originalname: req.file.originalname,
                        mimetype: req.file.mimetype,
                        size: req.file.size,
                        uploaded: true,
                        timestamp: new Date().toISOString()
                    },
                    submission: {
                        articleId: articleId,
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

                // Add specific flags based on file type
                if (FileField === 'manuscript_file') {
                    response.flags = {
                        manFile: true,
                        hasManuscript: true
                    };
                    response.manuscriptStatus = 'COMPLETE';
                } else if (FileField === 'cover_letter_file') {
                    response.flags = {
                        covFile: true,
                        hasCoverLetter: true
                    };
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

// Additional function to check file upload status
uploadSingleFile.checkUploadStatus = async (req, res) => {
    try {
        const articleId = req.articleId || req.query.articleId;
        
        if (!articleId) {
            return res.status(400).json({
                success: false,
                error: "No article ID provided"
            });
        }

        const submission = await SubmissionManager.getSubmissionData(articleId, req.user.email);
        
        if (!submission) {
            return res.status(404).json({
                success: false,
                error: "Submission not found"
            });
        }

        const uploadStatus = {
            manuscript_file: {
                uploaded: !!submission.manuscript_file,
                url: submission.manuscript_file,
                required: true
            },
            cover_letter_file: {
                uploaded: !!submission.cover_letter_file,
                url: submission.cover_letter_file,
                required: true
            },
            tables: {
                uploaded: !!submission.tables,
                url: submission.tables,
                required: false
            },
            figures: {
                uploaded: !!submission.figures,
                url: submission.figures,
                required: false
            },
            graphic_abstract: {
                uploaded: !!submission.graphic_abstract,
                url: submission.graphic_abstract,
                required: false
            },
            supplementary_material: {
                uploaded: !!submission.supplementary_material,
                url: submission.supplementary_material,
                required: false
            },
            tracked_manuscript_file: {
                uploaded: !!submission.tracked_manuscript_file,
                url: submission.tracked_manuscript_file,
                required: false
            }
        };

        // Check if all required files are uploaded
        const allRequiredUploaded = uploadStatus.manuscript_file.uploaded && 
                                  uploadStatus.cover_letter_file.uploaded;

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

// Export for use in other modules
module.exports = uploadSingleFile;
module.exports.validateManuscriptRequirements = validateManuscriptRequirements;
module.exports.FILE_CONFIG = FILE_CONFIG;