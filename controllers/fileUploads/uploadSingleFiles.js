require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");
const dotenv = require("dotenv").config();

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Configuration
const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Validate file types
        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/zip',
            'application/x-zip-compressed'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
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
                // Exponential backoff with jitter: baseDelay * 2^(attempt-1) ± 10%
                const delay = baseDelay * Math.pow(2, attempt - 1);
                const jitter = delay * 0.1 * (Math.random() * 2 - 1); // ±10% jitter
                const totalDelay = Math.max(100, delay + jitter);
                
                console.log(`Waiting ${Math.round(totalDelay)}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }
    }
    
    throw lastError;
}

// Sophisticated database operation with transaction support
async function updateSubmissionDatabase(articleId, fieldName, fileUrl, maxRetries = 3) {
    return await retryWithBackoff(async () => {
        let connection;
        try {
            // Get a connection for transaction
            connection = await dbPromise.getConnection();
            
            await connection.beginTransaction();

            // First check if the submission exists
            const [existingRecords] = await connection.query(
                "SELECT revision_id FROM submissions WHERE revision_id = ?",
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
                // Insert new record
                const [insertResult] = await connection.query(
                    `INSERT INTO submissions (revision_id, ${fieldName}, last_updated) 
                     VALUES (?, ?, NOW())`,
                    [articleId, fileUrl]
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

const uploadSingleFile = async (req, res) => {
    const FileField = req.params.field;
    const validFields = [
        'manuscript_file',
        'cover_letter_file',
        'tables',
        'figures',
        'graphic_abstract',
        'supplementary_material',
        'tracked_manuscript_file'
    ];

    // Validate field parameter
    if (!validFields.includes(FileField)) {
        return res.status(400).json({ 
            error: "Invalid file field specified",
            validFields: validFields
        });
    }

    try {
        // Handle file upload
        upload.single(FileField)(req, res, async (err) => {
            // Clean up local file in case of errors
            const cleanUpLocalFile = () => {
                if (req.file?.path && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
            };

            try {
                if (err) {
                    cleanUpLocalFile();
                    
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(413).json({ 
                            error: 'File exceeds maximum size of 50MB' 
                        });
                    }
                    
                    if (err.message === 'Invalid file type') {
                        return res.status(415).json({ 
                            error: 'Invalid file type. Please upload PDF, Word, image, or zip files.' 
                        });
                    }
                    
                    console.error('Upload error:', err);
                    return res.status(500).json({ 
                        error: 'File upload failed',
                        message: process.env.NODE_ENV === 'development' ? err.message : 'Please try again'
                    });
                }

                if (!req.file) {
                    return res.status(400).json({ 
                        error: "No file uploaded" 
                    });
                }

                let result;
                try {
                    // Upload to Cloudinary with retry logic
                    result = await retryWithBackoff(async () => {
                        return await cloudinary.uploader.upload(req.file.path, {
                            folder: "asfirj/original",
                            resource_type: "auto",
                            timeout: 120000, // 2 minute timeout per attempt
                            chunk_size: 6000000 // 6MB chunks for large files
                        });
                    }, 3, 1000);
                } catch (cloudinaryError) {
                    cleanUpLocalFile();
                    console.error("Cloudinary upload failed after retries:", cloudinaryError);
                    
                    return res.status(500).json({ 
                        error: "File upload failed after multiple attempts",
                        details: process.env.NODE_ENV === 'development' ? cloudinaryError.message : "Please try again later"
                    });
                }

                // Delete local file
                cleanUpLocalFile();

                // Initialize session data if not exists
                if (!req.session.manuscriptData) {
                    req.session.manuscriptData = {};
                }

                // Update session data
                req.session.manuscriptData[FileField] = {
                    url: result.secure_url,
                    uploaded: true,
                    timestamp: new Date()
                };

                // Set specific flags for required files
                if (FileField === 'manuscript_file') {
                    req.session.manuscriptData.manFile = true;
                } else if (FileField === 'cover_letter_file') {
                    req.session.manuscriptData.covFile = true;
                }
                req.session.hasNewFiles = true

                // Update database
                const articleId = req.session.articleId;
                if (!articleId) {
                    return res.status(400).json({ 
                        error: "No active manuscript session" 
                    });
                }

                try {
                    await updateSubmissionDatabase(articleId, FileField, result.secure_url, 3);
                } catch (dbError) {
                    console.error("Database update failed:", dbError);
                    return res.status(500).json({ 
                        error: "Failed to save file information",
                        details: process.env.NODE_ENV === 'development' ? dbError.message : "Please contact support"
                    });
                }

                // Save session explicitly
                req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error("Session save error:", saveErr);
                    }
                    
                    return res.json({ 
                        success: true, 
                        fileUrl: result.secure_url,
                        field: FileField,
                        flags: {
                            manFile: FileField === 'manuscript_file',
                            covFile: FileField === 'cover_letter_file'
                        }
                    });
                });

            } catch (error) {
                cleanUpLocalFile();
                console.error("File processing error:", error);
                
                return res.status(500).json({ 
                    error: "File processing failed",
                    details: process.env.NODE_ENV === 'development' ? error.message : "Please try again later"
                });
            }
        });
    } catch (error) {
        console.error("System error:", error);
        return res.status(500).json({ 
            error: "Internal server error" 
        });
    }
};

module.exports = uploadSingleFile;