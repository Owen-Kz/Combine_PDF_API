const fs = require('fs');
const path = require('path');
const multer = require('multer');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { PDFDocument } = require('pdf-lib');
const { Document, Packer, Paragraph } = require('docx');

// Setup Multer for file uploads
const upload = multer({ dest: 'uploads/' }).fields([
    { name: 'manuscript_file', maxCount: 1 },
    { name: 'tracked_manuscript', maxCount: 1 },
    { name: 'figures', maxCount: 10 },
    { name: 'supplementary_material', maxCount: 1 },
    { name: 'graphic_abstract', maxCount: 1 },
    { name: 'tables', maxCount: 10 }
]);

// Convert PDF to DOCX with basic text extraction
const convertPDFToDOCX = async (pdfPath, outputDocxPath) => {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const docx = new Document();

    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
        const page = pdfDoc.getPage(i);
        const text = await page.getTextContent(); // Extract text from page
        const paragraphs = text.items.map(item => new Paragraph(item.str));
        docx.addSection({ children: paragraphs });
    }

    const buffer = await Packer.toBuffer(docx);
    fs.writeFileSync(outputDocxPath, buffer);
};

// Check if the file is a valid DOCX by checking its extension
const isValidDocx = (filePath) => {
    const fileExtension = path.extname(filePath).toLowerCase();
    return fileExtension === '.docx';
};

// Convert PDFs to DOCX and return valid DOCX paths
const processFilesToDOCX = async (filePaths) => {
    const docxPaths = [];

    for (const filePath of filePaths) {
        if (path.extname(filePath).toLowerCase() === '.pdf') {
            const outputDocxPath = filePath.replace('.pdf', '.docx');
            await convertPDFToDOCX(filePath, outputDocxPath);
            docxPaths.push(outputDocxPath);
        } else if (isValidDocx(filePath)) {
            docxPaths.push(filePath); // Add DOCX files directly if valid
        } else {
            console.warn(`Skipping invalid file: ${filePath}`);
        }
    }

    console.log("path", docxPaths)
    return docxPaths;
};

// Function to merge DOCX files
const mergeDOCXFiles = async (docxPaths, outputFilePath) => {
    const zip = new PizZip();

    docxPaths.forEach(docxPath => {
        try {
            const content = fs.readFileSync(docxPath, 'binary');
            const doc = new Docxtemplater(new PizZip(content));
            zip.file(path.basename(docxPath), doc.getZip().generate({ type: 'nodebuffer' }));
        } catch (error) {
            console.error(`Error processing DOCX file ${docxPath}:`, error);
        }
    });

    fs.writeFileSync(outputFilePath, zip.generate({ type: 'nodebuffer' }));
    return outputFilePath;
};

// Main handler function
const CombineDOCX = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error uploading files' });
        }

        try {
            // Collect DOCX or PDF file paths to process
            const docxOrPdfPaths = [
                ...(req.files.manuscript_file || []).map(file => file.path),
                ...(req.files.tracked_manuscript || []).map(file => file.path),
                ...(req.files.figures || []).map(file => file.path),
                ...(req.files.supplementary_material || []).map(file => file.path),
                ...(req.files.graphic_abstract || []).map(file => file.path),
                ...(req.files.tables || []).map(file => file.path),
            ];

            // Convert PDFs to DOCX and gather all DOCX paths
            const docxPaths = await processFilesToDOCX(docxOrPdfPaths);

            // Merge DOCX files using Docxtemplater
            const combinedFilename = `combined-${Date.now()}.docx`;
            const combinedFilePath = path.join('uploads', combinedFilename);
            await mergeDOCXFiles(docxPaths, combinedFilePath);

            // Clean up temporary files
            docxOrPdfPaths.forEach(file => {
                if (file.endsWith('.pdf')) fs.unlinkSync(file); // Remove original PDFs
            });

            res.json({ success: true, filename: combinedFilename });
        } catch (error) {
            console.error('Error combining DOCX files', error);
            res.status(500).json({ success: false, message: 'Error combining DOCX files', filename:"noFILESENT"});
        }
    });
};

module.exports = CombineDOCX;
