const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const fileType = require('file-type');
const Mammoth = require('mammoth');
const { Document, Packer, Paragraph } = require('docx');

const documentFileFormat = async (req, res) => {
    const fileUrl = req.query.url;
    const download = req.query.download;

    if (!fileUrl) {
        return res.status(400).send('File URL is required');
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

        if (detectedType) {
            const correctExtension = `.${detectedType.ext}`;
            fileName = path.basename(fileName, path.extname(fileName)) + correctExtension;
        }

        console.log(`Detected file type: ${detectedType ? detectedType.mime : 'unknown'}`);

        if (detectedType && detectedType.ext === 'zip') {
            console.log(`Processing ZIP file: ${fileName}`);

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
                // Convert extracted content to Word
                const docxBuffer = await Packer.toBuffer(doc);
                res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace('.zip', '.docx')}"`);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                return res.send(docxBuffer);
            } else {
                console.log('ZIP does not contain text files, sending as is.');
                fileBuffer = zip.toBuffer();
            }
        }

        // Set correct content type based on detected file type
        const contentType = detectedType ? detectedType.mime : 'application/octet-stream';

        res.setHeader('Content-Disposition', download ? `attachment; filename="${fileName}"` : 'inline');
        res.setHeader('Content-Type', contentType);
        return res.send(fileBuffer);
    } catch (error) {
        console.error('Error processing file:', error.message);
        res.status(500).send('Error processing file, Please try again or refresh the page');
    }
};

module.exports = documentFileFormat;
