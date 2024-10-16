const axios = require('axios');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');
const { exec } = require('child_process');
const { Document, Packer, Paragraph } = require('docx');

const upload = multer({ dest: 'uploads/' }).fields([
    { name: 'manuscript_file', maxCount: 1 },
    { name: 'tracked_manuscript', maxCount: 1 },
    { name: 'figures', maxCount: 10 },
    { name: 'supplementary_material', maxCount: 1 },
    { name: 'graphic_abstract', maxCount: 1 },
    { name: 'tables', maxCount: 10 }
]);

const convertToDOCX = async (inputFilePath, outputFilePath) => {
    // Example conversion using LibreOffice for various formats to DOCX
    return new Promise((resolve, reject) => {
        const command = `libreoffice --headless --convert-to docx --outdir ${path.dirname(outputFilePath)} ${inputFilePath}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error converting ${inputFilePath} to DOCX: ${stderr}`);
                reject(error);
            } else {
                console.log(`File converted to DOCX: ${outputFilePath}`);
                resolve(outputFilePath);
            }
        });
    });
};

const convertFilesToDOCX = async (files) => {
    const convertedFiles = [];

    for (const file of files) {
        const { path: inputFilePath, originalname } = file;
        const outputFilePath = `${inputFilePath}.docx`;

        // Check if file is already a DOCX
        if (path.extname(originalname).toLowerCase() === '.docx') {
            convertedFiles.push(inputFilePath);
        } else {
            try {
                await convertToDOCX(inputFilePath, outputFilePath);
                convertedFiles.push(outputFilePath);
            } catch (error) {
                console.error(`Error converting ${inputFilePath} to DOCX: ${error.message}`);
            }
        }
    }

    return convertedFiles;
};

const mergeDOCXFiles = async (docxPaths) => {
    const mergedDoc = new Document();

    for (const docxPath of docxPaths) {
        const fileBuffer = fs.readFileSync(docxPath);
        const doc = await Document.load(fileBuffer);

        // Extract paragraphs from the document and add them to the merged document
        doc.paragraphs.forEach(paragraph => mergedDoc.addParagraph(paragraph));
    }

    const mergedDocBuffer = await Packer.toBuffer(mergedDoc);
    return mergedDocBuffer;
};

const uploadCombinedDOCXToPHPServer = async (combinedFilePath, combinedFilename) => {
    const form = new FormData();
    form.append('combined_file', fs.createReadStream(combinedFilePath));

    try {
        const response = await axios.post(process.env.ASFIRJ_SERVER, form, {
            headers: {
                ...form.getHeaders()
            }
        });

        console.log('File uploaded successfully', response.data);
        if (response.data.success) {
            // Delete combined file
            fs.unlink(combinedFilePath, function (err) {
                if (err) throw err;
                console.log('File deleted:', combinedFilePath);
            });
        } else {
            console.log('Upload failed:', response.data.message);
        }
    } catch (error) {
        console.error('Error uploading file', error);
    }
};

const cleanUpConvertedFiles = (files) => {
    files.forEach((filePath) => {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(`Error deleting file ${filePath}`, err);
            } else {
                console.log(`Deleted file: ${filePath}`);
            }
        });
    });
};

const CombineDOCX = async (req, res) => {
    console.log("DOCX Combine Started");

    upload(req, res, async (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error uploading files' });
        }

        console.log("Files Received");

        try {
            const { manuscript_file, tracked_manuscript, figures, supplementary_material, graphic_abstract, tables } = req.files;

            // Convert all files to DOCX
            const convertedFiles = await convertFilesToDOCX([
                ...(manuscript_file || []),
                ...(tracked_manuscript || []),
                ...(figures || []),
                ...(supplementary_material || []),
                ...(graphic_abstract || []),
                ...(tables || [])
            ]);

            // Merge DOCX files
            const combinedDocxBytes = await mergeDOCXFiles(convertedFiles);
            const combinedFilename = `combined-${Date.now()}.docx`;
            const combinedFilePath = path.join('uploads', combinedFilename);
            fs.writeFileSync(combinedFilePath, combinedDocxBytes);

            console.log("File Combination Complete,", combinedFilename);

            // Upload the combined DOCX to the PHP server
            await uploadCombinedDOCXToPHPServer(combinedFilePath, combinedFilename);

            // Clean up temporary files
            cleanUpConvertedFiles(convertedFiles);

            res.json({ success: true, filename: combinedFilename });

        } catch (error) {
            console.error('Error combining DOCX files', error);
            res.status(500).json({ success: false, message: 'Error combining DOCX files' });
        }
    });
};

module.exports = CombineDOCX;
