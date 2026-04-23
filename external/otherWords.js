const axios = require('axios');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');
const dbPromise = require('../routes/dbPromise.config');

// Helper function to extract text from Word document XML with proper formatting
async function extractTextFromWordXml(xmlContent) {
    try {
        const parser = new xml2js.Parser({ explicitArray: true, mergeAttrs: true });
        const result = await parser.parseStringPromise(xmlContent);
        
        let extractedText = '';
        
        // Navigate through the Word document structure
        if (result && result['w:document'] && result['w:document']['w:body']) {
            const body = result['w:document']['w:body'][0];
            
            // Process each paragraph (w:p)
            const paragraphs = body['w:p'] || [];
            
            for (const p of paragraphs) {
                let paragraphText = '';
                let isHeading = false;
                let isListItem = false;
                let listLevel = 0;
                
                // Check for paragraph properties
                if (p['w:pPr']) {
                    const pPr = p['w:pPr'][0];
                    
                    // Check if it's a heading
                    if (pPr['w:pStyle']) {
                        const style = pPr['w:pStyle'][0]['w:val'];
                        if (style && style.includes('Heading')) {
                            isHeading = true;
                        }
                    }
                    
                    // Check for numbering (lists)
                    if (pPr['w:numPr']) {
                        isListItem = true;
                        // Get list level if available
                        if (pPr['w:numPr'][0]['w:ilvl']) {
                            listLevel = parseInt(pPr['w:numPr'][0]['w:ilvl'][0]['w:val']) || 0;
                        }
                    }
                }
                
                // Process text runs (w:r)
                const runs = p['w:r'] || [];
                for (const r of runs) {
                    // Get text from runs
                    const textElements = r['w:t'] || [];
                    for (const t of textElements) {
                        if (t._) {
                            paragraphText += t._;
                        } else if (typeof t === 'string') {
                            paragraphText += t;
                        }
                    }
                    
                    // Add line breaks for line breaks (w:br)
                    if (r['w:br']) {
                        paragraphText += '\n';
                    }
                }
                
                // Clean up the paragraph text
                paragraphText = paragraphText.trim();
                
                if (paragraphText) {
                    // Format based on type
                    if (isHeading) {
                        extractedText += `\n\n${paragraphText.toUpperCase()}\n` + '='.repeat(paragraphText.length) + '\n';
                    } else if (isListItem) {
                        const indent = '    '.repeat(listLevel);
                        extractedText += `\n${indent}• ${paragraphText}`;
                    } else {
                        // Check if it might be a day header (like "Day 1:")
                        if (paragraphText.match(/^Day \d+:/i)) {
                            extractedText += `\n\n${paragraphText}`;
                        } 
                        // Check if it might be a goal statement
                        else if (paragraphText.match(/^Goal:/i)) {
                            extractedText += `\n${paragraphText}`;
                        }
                        // Regular paragraph
                        else if (paragraphText.length > 0) {
                            extractedText += `\n${paragraphText}`;
                        }
                    }
                }
            }
            
            // Add a note about the document type
            extractedText = "DOCUMENT CONTENT\n" + 
                          "================\n" + 
                          extractedText + 
                          "\n\nNote: This document was converted from a Word document. Some formatting may have been adjusted.";
        }
        
        return extractedText || 'No readable text found in document';
    } catch (error) {
        console.error('Error parsing Word XML:', error);
        return 'Error extracting text from Word document';
    }
}

// Helper function to create nicely formatted DOCX
async function createFormattedDocx(textContent, fileName, fileTitle) {
    const lines = textContent.split('\n');
    const children = [];
    
    // Process each line to maintain formatting
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('DOCUMENT CONTENT') || trimmedLine.startsWith('================')) {
            continue; // Skip the header
        }
        
        if (trimmedLine.startsWith('=') && trimmedLine.length > 5) {
            continue; // Skip separator lines
        }
        
        if (trimmedLine.match(/^[A-Z\s]+$/) && trimmedLine.length > 10) {
            // ALL CAPS lines - likely headings
            children.push(
                new Paragraph({
                    text: trimmedLine,
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.LEFT
                })
            );
        }
        else if (trimmedLine.match(/^Week \d+:/i)) {
            // Week headers
            children.push(
                new Paragraph({
                    text: trimmedLine,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 200 }
                })
            );
        }
        else if (trimmedLine.match(/^Day \d+:/i)) {
            // Day headers
            children.push(
                new Paragraph({
                    text: trimmedLine,
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 200, after: 100 }
                })
            );
        }
        else if (trimmedLine.match(/^Goal:/i)) {
            // Goal statements
            children.push(
                new Paragraph({
                    text: trimmedLine,
                    heading: HeadingLevel.HEADING_4,
                    spacing: { before: 100, after: 50 }
                })
            );
        }
        else if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
            // Bullet points
            children.push(
                new Paragraph({
                    text: trimmedLine.substring(1).trim(),
                    bullet: { level: 0 }
                })
            );
        }
        else if (trimmedLine.length > 0) {
            // Regular paragraph
            children.push(
                new Paragraph({
                    text: trimmedLine,
                    spacing: { after: 100 }
                })
            );
        } else {
            // Empty line - add spacing
            children.push(new Paragraph({ text: "" }));
        }
    }
    
    const doc = new Document({
        sections: [{
            properties: {},
            children: children
        }]
    });
    
    return await Packer.toBuffer(doc);
}

const documentFileFormat = async (req, res) => {
    const fileUrl = req.query.url;
    const download = req.query.download;
    const filenameFromQuery = req.query.filename;

    if (!fileUrl) {
        return res.status(400).send('File URL is required');
    }

    try {
        // Check if this is a new submission (local file) or old submission (Cloudinary)
        let isOldSubmission = true;
        let submissionData = null;

        // Query to find the submission containing this file
        const [submissions] = await dbPromise.query(
            `SELECT * FROM submissions 
             WHERE manuscript_file = ? 
                OR tracked_manuscript_file = ? 
                OR cover_letter_file = ? 
                OR tables = ? 
                OR figures = ? 
                OR document_file = ? 
                OR graphic_abstract = ? 
                OR supplementary_material = ?`,
            [fileUrl, fileUrl, fileUrl, fileUrl, fileUrl, fileUrl, fileUrl, fileUrl]
        );

        if (submissions && submissions.length > 0) {
            submissionData = submissions[0];
            isOldSubmission = submissionData.is_old_submission !== "no"; // Default to true if not specified
        }

        // For new submissions (local files), just redirect to the file
        if (!isOldSubmission) {
            console.log('Serving new submission file directly:', fileUrl);
            
            // Set appropriate headers for viewing/downloading
            const shouldDownload = download === 'true' || download === '1';
            
            if (shouldDownload) {
                // Extract filename from URL for download
                const urlParts = fileUrl.split('/');
                const fileName = filenameFromQuery || urlParts[urlParts.length - 1] || 'document';
                
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
            } else {
                res.setHeader('Content-Disposition', 'inline');
            }
            
            // Redirect to the actual file
            return res.redirect(fileUrl);
        }

        // For old submissions, continue with Cloudinary processing
        console.log('Processing old submission file from Cloudinary:', fileUrl);
        
        let fileTitle = "";
        if (req.query.id) {
            try {
                const GetTitle = await dbPromise.query(
                    "SELECT title FROM submissions WHERE revision_id = ?", 
                    [req.query.id]
                );
                if (GetTitle[0].length > 0) {
                    fileTitle = GetTitle[0][0].title;
                }
            } catch (dbError) {
                console.warn('Could not fetch title from database:', dbError.message);
            }
        }

        // Parse Cloudinary URL
        const parsedUrl = new URL(fileUrl);
        const filePath = parsedUrl.pathname;
        let fileName = path.basename(filePath);

        // Check if it's a Cloudinary .auto file
        const isCloudinaryAutoFile = fileName.toLowerCase().endsWith('.auto');
        
        // Fetch file from Cloudinary
        console.log(`Fetching file from Cloudinary: ${filePath}`);
        const response = await axios.get(`https://res.cloudinary.com${filePath}`, {
            responseType: 'arraybuffer',
            auth: {
                username: process.env.CLOUDINARY_API_KEY,
                password: process.env.CLOUDINARY_API_SECRET,
            },
            timeout: 30000 // 30 second timeout
        });

        let fileBuffer = Buffer.from(response.data);
        
        // Determine final filename
        let finalFileName = filenameFromQuery || fileName;
        
        // Handle .auto files by extracting their actual content
        if (isCloudinaryAutoFile) {
            console.log(`Processing Cloudinary .auto file: ${fileName}`);
            finalFileName = finalFileName.replace(/\.auto$/i, '.docx');
            
            // Check if it's a ZIP file (Office documents are ZIP archives)
            const isZip = fileBuffer.slice(0, 4).toString('hex') === '504b0304';
            
            if (isZip) {
                console.log('Detected ZIP content in .auto file');
                
                try {
                    const zip = new AdmZip(fileBuffer);
                    const zipEntries = zip.getEntries();
                    
                    // Look for the main document.xml in Word documents
                    const wordDocEntry = zipEntries.find(entry => 
                        entry.entryName === 'word/document.xml'
                    );
                    
                    if (wordDocEntry) {
                        console.log('Found Word document in .auto file');
                        
                        // Extract the document.xml content
                        const docXml = wordDocEntry.getData().toString('utf8');
                        
                        // Parse the Word XML to extract text with formatting
                        const extractedText = await extractTextFromWordXml(docXml);
                        
                        // Create a clean formatted DOCX with the extracted text
                        const docxBuffer = await createFormattedDocx(
                            extractedText, 
                            fileName, 
                            fileTitle
                        );
                        
                        fileBuffer = docxBuffer;
                    } else {
                        // Try to find any readable content
                        let extractedContent = '';
                        
                        // Look for text files in the ZIP
                        const textEntries = zipEntries.filter(entry => 
                            !entry.isDirectory && 
                            (entry.entryName.toLowerCase().includes('document') ||
                             entry.entryName.toLowerCase().endsWith('.txt') ||
                             entry.entryName.toLowerCase().endsWith('.text'))
                        );
                        
                        if (textEntries.length > 0) {
                            // Use the first document-like file
                            const mainDocEntry = textEntries[0];
                            extractedContent = mainDocEntry.getData().toString('utf8');
                            
                            // Try to clean up XML if present
                            if (extractedContent.includes('<')) {
                                extractedContent = extractedContent
                                    .replace(/<[^>]*>/g, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim();
                            }
                        } else {
                            // List contents if no document found
                            extractedContent = "Archive Contents:\n\n";
                            zipEntries.forEach((entry) => {
                                if (!entry.isDirectory) {
                                    extractedContent += `• ${entry.entryName}\n`;
                                }
                            });
                            extractedContent += "\n\nNote: This appears to be an archive file. Please download the original file to view its contents.";
                        }
                        
                        const docxBuffer = await createFormattedDocx(
                            extractedContent, 
                            fileName, 
                            fileTitle
                        );
                        fileBuffer = docxBuffer;
                    }
                } catch (zipError) {
                    console.error('Error processing ZIP:', zipError);
                    
                    // Create error document
                    const errorDoc = new Document({
                        sections: [{
                            properties: {},
                            children: [
                                new Paragraph({
                                    text: "Error Processing File",
                                    heading: HeadingLevel.TITLE
                                }),
                                new Paragraph(`Original file: ${fileName}`),
                                new Paragraph(""),
                                new Paragraph("This file could not be processed properly."),
                                new Paragraph(`Error: ${zipError.message}`),
                                new Paragraph(""),
                                new Paragraph("Please try downloading the original file from Cloudinary.")
                            ]
                        }]
                    });
                    
                    fileBuffer = await Packer.toBuffer(errorDoc);
                }
            } else {
                // Not a ZIP - treat as plain text
                console.log('Treating .auto file as plain text');
                const textContent = fileBuffer.toString('utf8');
                const docxBuffer = await createFormattedDocx(textContent, fileName, fileTitle);
                fileBuffer = docxBuffer;
            }
        }
        
        // Set response headers
        const encodedFilename = encodeURIComponent(finalFileName);
        const shouldDownload = download === 'true' || download === '1' || isCloudinaryAutoFile;
        
        res.setHeader('Content-Disposition', 
            shouldDownload 
                ? `attachment; filename="${finalFileName}"; filename*=UTF-8''${encodedFilename}`
                : 'inline');
        
        res.setHeader('Content-Type', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        
        console.log(`Serving: ${finalFileName} as DOCX`);
        
        return res.send(fileBuffer);

    } catch (error) {
        console.error('Error processing file:', error.message);
        
        // Try fallback redirect for new submissions
        try {
            if (fileUrl && !fileUrl.includes('cloudinary')) {
                console.log('Attempting fallback redirect to:', fileUrl);
                return res.redirect(fileUrl);
            }
        } catch (redirectError) {
            console.error('Fallback redirect failed:', redirectError.message);
        }
        
        // Send error as DOCX
        try {
            const errorDoc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            text: "Error Processing File",
                            heading: HeadingLevel.TITLE
                        }),
                        new Paragraph(`There was an error processing your file.`),
                        new Paragraph(`File: ${req.query.filename || 'Unknown'}`),
                        new Paragraph(`Error: ${error.message}`),
                        new Paragraph(""),
                        new Paragraph("Please try downloading the original file directly.")
                    ]
                }]
            });
            
            const errorBuffer = await Packer.toBuffer(errorDoc);
            res.setHeader('Content-Type', 
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', 'attachment; filename="error.docx"');
            return res.send(errorBuffer);
        } catch (docxError) {
            res.status(500).send(`Error processing file: ${error.message}`);
        }
    }
};

module.exports = documentFileFormat;