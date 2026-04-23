const axios = require('axios');
const path = require('path');


const downloadFile = async (req, res) => {
    const fileUrl = req.query.url;
    const download = req.query.download;
  
    if (!fileUrl) {
      return res.status(400).send('File URL is required');
    }
  
    try {
      // Parse Cloudinary URL for file path
      const parsedUrl = new URL(fileUrl);
      const filePath = parsedUrl.pathname;
  
      // Fetch file with Cloudinary API authentication
      const response = await axios.get(`https://res.cloudinary.com${filePath}`, {
        responseType: 'stream',
        auth: {
          username: process.env.CLOUDINARY_API_KEY, // Replace with your API Key
          password: process.env.CLOUDINARY_API_SECRET, // Replace with your API Secret
        },
      });
  
      const fileName = path.basename(parsedUrl.pathname);
  
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      } else {
        res.setHeader('Content-Disposition', 'inline');
      }
  
      res.setHeader('Content-Type', 'application/pdf');
      response.data.pipe(res);
    } catch (error) {
      console.error('Error fetching file:', error.message);
      res.status(500).send('Error fetching file');
    }
  }  

module.exports = downloadFile