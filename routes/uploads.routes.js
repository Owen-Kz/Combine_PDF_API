// routes/uploads.routes.js
// Public image-upload endpoint consumed by the RichTextEditor:
//
//   POST /api/uploads/editor-image   (multipart, field name: `image`)
//
// Saves the image to useruploads/editor-images/ and returns the public URL:
//   { status: "success", url: "https://.../useruploads/editor-images/<file>" }
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { LogAction } = require("../Logger");

const router = express.Router();

const EDITOR_IMAGE_DIR = path.join(__dirname, "../useruploads/editor-images");
fs.mkdirSync(EDITOR_IMAGE_DIR, { recursive: true });

const ALLOWED_IMAGE_MINETYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
]);

const EXT_TO_MIMETYPE = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, EDITOR_IMAGE_DIR),
    filename: (req, file, cb) => {
        const ext = (path.extname(file.originalname || "") || ".png").toLowerCase();
        const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
        cb(null, `editor-image_${uniqueSuffix}${ext}`);
    },
});

const uploadSingleImage = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1,
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const mimetypeOk = ALLOWED_IMAGE_MINETYPES.has(file.mimetype);
        const extOk = !!EXT_TO_MIMETYPE[ext];
        if (mimetypeOk && extOk) return cb(null, true);
        cb(new Error("Only image files (JPEG, PNG, GIF, WEBP, BMP) are allowed"));
    },
});

router.post("/editor-image", (req, res) => {
    uploadSingleImage.single("image")(req, res, (err) => {
        if (err) {
            const message =
                err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
                    ? "Image too large. Maximum size is 10MB."
                    : err.message || "Image upload failed";
            return res.status(400).json({ status: "error", message });
        }

        if (!req.file) {
            return res.status(400).json({
                status: "error",
                message: "No image file received. The multipart field name must be `image`.",
            });
        }

        const domain = (process.env.CURRENT_DOMAIN || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
        const url = `${domain}/useruploads/editor-images/${req.file.filename}`;
        LogAction(`Editor image uploaded: ${req.file.filename}`);
        return res.status(200).json({ status: "success", url });
    });
});

module.exports = router;