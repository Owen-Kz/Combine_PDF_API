require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Configuration with file size limit
const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

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
            try {
                if (err) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(413).json({ 
                            error: 'File exceeds maximum size of 5MB' 
                        });
                    }
                    console.error('Upload error:', err);
                    return res.status(500).json({ 
                        error: 'File upload failed' 
                    });
                }

                if (!req.file) {
                    return res.status(400).json({ 
                        error: "No file uploaded" 
                    });
                }

                // Upload to Cloudinary
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: "asfirj/original",
                    resource_type: "auto",
                    timeout: 900000 // 3 minute timeout
                });

                // Delete local file
                fs.unlinkSync(req.file.path);

                // Update session data
                // req.session.manuscriptData = req.session.manuscriptData || {};
                // req.session.manuscriptData.files = req.session.manuscriptData.files || {};
                
                // Track file status
          
                req.session.manuscriptData[FileField] = {}
                req.session.manuscriptData[FileField] = {
                    url: result.secure_url,
                    uploaded: true,
                    timestamp: new Date()
                };

                // Update database
                const articleId = req.session.articleId;
                if (!articleId) {
                    return res.status(400).json({ 
                        error: "No active manuscript session" 
                    });
                }

                const [updateResult] = await dbPromise.query(
                    `UPDATE submissions SET ${FileField} = ? WHERE revision_id = ?`,
                    [result.secure_url, articleId]
                );

                if (updateResult.affectedRows === 0) {
                    return res.status(404).json({ 
                        error: "Manuscript not found or not updated" 
                    });
                }

                return res.json({ 
                    success: true, 
                    fileUrl: result.secure_url,
                    field: FileField
                });

            } catch (error) {
                console.error("File processing error:", error);
                // Clean up uploaded file if it exists
                if (req.file?.path) {
                    fs.unlink(req.file.path, () => {});
                }
                return res.status(500).json({ 
                    error: "File processing failed",
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
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