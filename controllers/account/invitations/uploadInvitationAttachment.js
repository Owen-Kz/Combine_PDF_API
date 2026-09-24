// backend/controllers/editors/uploadInvitationAttachment.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'useruploads', 'invitation-attachments');
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
      cb(null, UPLOADS_ROOT);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
    const suffix = crypto.randomBytes(6).toString('hex');
    cb(null, `Invite_${Date.now()}_${suffix}_${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

const uploadInvitationAttachment = (req, res) => {
  upload.single('attachment')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          status: 'error',
          message: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
        });
      }
      console.error('Invitation attachment upload error:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }

    const baseUrl = process.env.CURRENT_DOMAIN || `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/useruploads/invitation-attachments/${req.file.filename}`;

    return res.json({
      status: 'success',
      fileUrl,
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  });
};

module.exports = uploadInvitationAttachment;