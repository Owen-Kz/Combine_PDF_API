const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const fileType = require('file-type');
const Mammoth = require('mammoth');
const { Document, Packer, Paragraph } = require('docx');
const dbPromise = require('../routes/dbPromise.config');
const documentFileFormat = async (req, res) => {
    const fileUrl = req.query.url;
    const download = req.query.download;
    const filenameFromQuery = req.query.filename; // Get filename from query parameter

    if (!fileUrl) {
        return res.status(400).send('File URL is required');
    }
    
    let fileTitle = ""
    if(req.query.id){
        // Get file title
        const GetTitle = await dbPromise.query("SELECT title FROM submissions WHERE revision_id = ?", [req.query.id]);
        if(GetTitle[0].length > 0){
            fileTitle = GetTitle[0][0].title
        }
    }

    try {
        // Parse Cloudinary URL and get file name
        const parsedUrl = new URL(fileUrl);
        const filePath = parsedUrl.pathname;
        let fileName = path.basename(filePath);

        // Fetch file from Cloudinary as a buffer
        const response = await axios.get(`https://res.cloudinary.com${filePath}`, {
            responseType: 'arraybuffer',
            auth: {
                username: process.env.CLOUDINARY_API_KEY,
                password: process.env.CLOUDINARY_API_SECRET,
            },
        });

        let fileBuffer = Buffer.from(response.data);

        // Detect file type from buffer
        const detectedType = await fileType.fromBuffer(fileBuffer);

        // Determine the final filename - PRIORITIZE filename from query parameter
        let finalFileName = filenameFromQuery || fileName; // Use query filename first

        if (!filenameFromQuery) {
            // Only use database title or URL filename if no filename from query
            if (fileTitle) {
                const baseTitle = fileTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const correctExtension = detectedType ? `.${detectedType.ext}` : path.extname(fileName);
                finalFileName = `${baseTitle}${correctExtension}`;
                console.log("Using database title for filename:", finalFileName);
            } else if (detectedType) {
                const baseName = path.basename(fileName, path.extname(fileName));
                const correctExtension = `.${detectedType.ext}`;
                finalFileName = baseName + correctExtension;
                console.log("Using URL filename with corrected extension:", finalFileName);
            }
        } else {
            console.log("Using filename from query parameter:", finalFileName);
        }

        console.log(`Final filename: ${finalFileName}`);
      

        if (detectedType && detectedType.ext === 'zip') {
            console.log(`Processing ZIP file: ${finalFileName}`);

            // Extract ZIP contents
            const zip = new AdmZip(fileBuffer);
            const zipEntries = zip.getEntries();

            let doc = new Document();
            let converted = false;

            zipEntries.forEach((entry) => {
                if (!entry.isDirectory && path.extname(entry.entryName) === '.txt') {
                    let textContent = entry.getData().toString('utf8');
                    doc.addSection({ children: [new Paragraph(textContent)] });
                    converted = true;
                }
            });

            if (converted) {
                // Convert extracted content to Word - use the base filename with .docx extension
                const baseName = fileTitle 
                    ? fileTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()
                    : path.basename(fileName, path.extname(fileName));
                
                const docxFileName = `${baseName}.docx`;
                const docxBuffer = await Packer.toBuffer(doc);
                
                console.log(`Serving converted DOCX file: ${docxFileName}`);
                
                // Properly encode filename for Content-Disposition header
                const encodedFilename = encodeURIComponent(docxFileName);
                res.setHeader('Content-Disposition', `attachment; filename="${docxFileName}"; filename*=UTF-8''${encodedFilename}`);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                return res.send(docxBuffer);
            } else {
                console.log('ZIP does not contain text files, sending as is.');
                fileBuffer = zip.toBuffer();
                // Update detected type since we're sending the zip buffer
                const zipDetectedType = await fileType.fromBuffer(fileBuffer);
                if (zipDetectedType) {
                    finalFileName = finalFileName.replace(path.extname(finalFileName), `.${zipDetectedType.ext}`) || finalFileName;
                }
            }
        }

        // Set correct content type based on detected file type
        const contentType = detectedType ? detectedType.mime : 'application/octet-stream';
        console.log(`Serving file: ${finalFileName} with content type: ${contentType}`);
        
        // Properly encode filename for Content-Disposition header
        const encodedFilename = encodeURIComponent(finalFileName);
        res.setHeader('Content-Disposition', download ? `attachment; filename="${finalFileName}"; filename*=UTF-8''${encodedFilename}` : 'inline');
        res.setHeader('Content-Type', contentType);
        return res.send(fileBuffer);
    } catch (error) {
        console.error('Error processing file:', error?.message);
        res.status(500).send('Error processing file, Please try again or refresh the page');
    }
};

module.exports = documentFileFormat;