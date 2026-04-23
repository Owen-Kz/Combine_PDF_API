const axios = require('axios');
const path = require('path');
const mime = require('mime'); // To get MIME type of the file

const downloadFile = async (req, res) => {
  const fileUrl = req.query.url;
  const requestedFileName = req.query.filename; // Use a different variable name

  if (!fileUrl) {
    return res.status(400).send('File URL is required');
  }

  try {
    // Parse the file URL
    const parsedUrl = new URL(fileUrl);
    const filePath = parsedUrl.pathname;

    // Determine the filename to use
    let finalFileName;
    if (requestedFileName) {
      finalFileName = requestedFileName;
    } else {
      // If no filename provided, extract from URL
      finalFileName = path.basename(parsedUrl.pathname);
    }

    // Clean up filename - remove query parameters and sanitize
    finalFileName = decodeURIComponent(finalFileName).split('?')[0];

    // Fetch file metadata with Cloudinary API authentication
    const response = await axios.head(`https://res.cloudinary.com${filePath}`, {
      auth: {
        username: process.env.CLOUDINARY_API_KEY,
        password: process.env.CLOUDINARY_API_SECRET,
      },
    });

    const contentType = response.headers['content-type'];

    // Function to fix file extension based on content type
    const fixFileExtension = (filename, mimeType) => {
      const ext = path.extname(filename).toLowerCase();
      const baseName = path.basename(filename, ext);
      
      // List of document MIME types that should use .docx
      const docMimeTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.apple.pages'
      ];

      // If it's a document file and has a .auto extension, change to .docx
      if (docMimeTypes.includes(mimeType) && ext === '.auto') {
        return `${baseName}.docx`;
      }

      // If the extension is .auto but we have a better guess from mime type
      if (ext === '.auto' && mimeType) {
        const properExt = mime.getExtension(mimeType);
        if (properExt) {
          return `${baseName}.${properExt}`;
        }
      }

      // If the extension doesn't match the mime type, fix it
      if (mimeType && ext !== '.auto') {
        const expectedExt = mime.getExtension(mimeType);
        if (expectedExt && expectedExt !== ext.replace('.', '')) {
          console.log(`Extension mismatch: ${ext} vs expected .${expectedExt}, using original`);
          // Optionally, you could fix it here:
          // return `${baseName}.${expectedExt}`;
        }
      }

      return filename;
    };

    // Fix the filename extension if needed
    finalFileName = fixFileExtension(finalFileName, contentType);

    // Check if the file is a PDF
    if (contentType === 'application/pdf') {
      // Fetch the file data for PDF display
      const pdfResponse = await axios.get(`https://res.cloudinary.com${filePath}`, {
        responseType: 'stream',
        auth: {
          username: process.env.CLOUDINARY_API_KEY,
          password: process.env.CLOUDINARY_API_SECRET,
        },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(finalFileName)}"`);
      pdfResponse.data.pipe(res);
    } else {
      // For other file types, fetch and stream with proper filename
      const fileResponse = await axios.get(`https://res.cloudinary.com${filePath}`, {
        responseType: 'stream',
        auth: {
          username: process.env.CLOUDINARY_API_KEY,
          password: process.env.CLOUDINARY_API_SECRET,
        },
      });

      // Set headers for download
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalFileName)}"`);
      res.setHeader('Content-Length', response.headers['content-length']);

      // Stream the file to the client
      fileResponse.data.pipe(res);
    }
  } catch (error) {
    console.error('Error handling file:', error.message);
    
    // Fallback: try to redirect if streaming fails
    try {
      console.log('Attempting fallback redirect to:', fileUrl);
      return res.redirect(fileUrl);
    } catch (redirectError) {
      console.error('Fallback redirect also failed:', redirectError.message);
      res.status(500).send('Error processing the file');
    }
  }
};

module.exports = downloadFile;