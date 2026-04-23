require("dotenv").config();
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000 // 60 second timeout
});

/**
 * Uploads a file to Cloudinary with retry logic.
 * @param {string|Buffer} fileData - The local file path or buffer to upload.
 * @param {string} fileName - The original file name.
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3).
 * @param {number} retryDelay - Delay between retries in ms (default: 1000).
 * @returns {Promise<string>} - The URL of the uploaded file.
 */
async function uploadToCloudinary(fileData, fileName, maxRetries = 3, retryDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Upload attempt ${attempt}/${maxRetries} for file: ${fileName}`);
      
      // Add exponential backoff delay for retries (except first attempt)
      if (attempt > 1) {
        const backoffDelay = retryDelay * Math.pow(2, attempt - 2); // Exponential backoff
        console.log(`Waiting ${backoffDelay}ms before retry ${attempt}...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }

      const uploadOptions = {
        folder: "asfirj/email_attachments",
        public_id: `${Date.now()}_${fileName.split(".")[0].replace(/[^a-zA-Z0-9]/g, '_')}`, // Sanitize filename
        resource_type: "auto",
        timeout: 60000,
        // Add unique identifier to prevent duplicate public_id conflicts
        use_filename: true,
        unique_filename: true
      };

      let result;
      
      // Handle both file path (string) and buffer uploads
      if (typeof fileData === 'string') {
        // File path upload
        result = await cloudinary.uploader.upload(fileData, uploadOptions);
      } else {
        // Buffer upload - convert to base64 data URI
        const base64Data = fileData.toString('base64');
        const dataUri = `data:application/octet-stream;base64,${base64Data}`;
        result = await cloudinary.uploader.upload(dataUri, uploadOptions);
      }

      console.log(`Upload successful for ${fileName} on attempt ${attempt}`);
      return result.secure_url; // Return the uploaded file URL
      
    } catch (error) {
      lastError = error;
      console.error(`Upload attempt ${attempt}/${maxRetries} failed for ${fileName}:`, error.message);
      
      // Don't retry on certain errors
      if (error.http_code === 400 || error.http_code === 401 || error.http_code === 403) {
        console.error(`Non-retryable error (${error.http_code}), stopping retries`);
        break;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`All ${maxRetries} upload attempts failed for ${fileName}`);
      }
    }
  }
  
  // If we get here, all retries failed
  throw new Error(`Failed to upload ${fileName} after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

/**
 * Uploads multiple files to Cloudinary with individual retry logic.
 * @param {Array<{data: string|Buffer, name: string}>} files - Array of file objects.
 * @param {number} maxRetries - Maximum retry attempts per file.
 * @returns {Promise<Array<{name: string, url: string, success: boolean, error?: string}>>}
 */
async function uploadMultipleToCloudinary(files, maxRetries = 3) {
  const uploadPromises = files.map(async (file) => {
    try {
      const url = await uploadToCloudinary(file.data, file.name, maxRetries);
      return {
        name: file.name,
        url: url,
        success: true
      };
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error.message);
      return {
        name: file.name,
        success: false,
        error: error.message
      };
    }
  });

  return Promise.all(uploadPromises);
}

/**
 * Uploads a file buffer to Cloudinary with retry logic.
 * @param {Buffer} fileBuffer - The file buffer.
 * @param {string} fileName - The original file name.
 * @param {number} maxRetries - Maximum number of retry attempts.
 * @returns {Promise<string>} - The URL of the uploaded file.
 */
async function uploadBufferToCloudinary(fileBuffer, fileName, maxRetries = 3) {
  return uploadToCloudinary(fileBuffer, fileName, maxRetries);
}

// If you want to upload files in parallel (faster but more resource intensive)
async function uploadFilesInParallel(files) {
  const uploadPromises = files.map(async (file) => {
    try {
      const url = await uploadToCloudinary(file.path, file.originalname, 3);
      return {
        name: file.originalname,
        url: url,
        content: file.buffer ? file.buffer.toString("base64") : null,
        size: file.size,
        mimetype: file.mimetype,
        success: true
      };
    } catch (error) {
      console.error(`Failed to upload ${file.originalname}:`, error.message);
      return {
        name: file.originalname,
        error: error.message,
        success: false
      };
    }
  });

  const results = await Promise.all(uploadPromises);
  
  // Separate successful and failed uploads
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Successfully uploaded: ${successful.length}/${files.length} files`);
  if (failed.length > 0) {
    console.warn(`Failed uploads:`, failed.map(f => f.name).join(', '));
  }
  
  return successful;
}

module.exports = { 
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadBufferToCloudinary,
  uploadFilesInParallel
};