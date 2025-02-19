require("dotenv").config();
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file to Cloudinary.
 * @param {string} filePath - The local file path to upload.
 * @param {string} fileName - The original file name.
 * @returns {Promise<string>} - The URL of the uploaded file.
 */
async function uploadToCloudinary(filePath, fileName) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "asfirj/email_attachments",
      public_id: fileName.split(".")[0], // Extract filename without extension
      resource_type: "auto",
    });

    return result.secure_url; // Return the uploaded file URL
  } catch (error) {
    console.error("Cloudinary Upload Error:", error.message);
    throw error;
  }
}

module.exports = { uploadToCloudinary };
