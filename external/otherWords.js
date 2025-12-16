const axios = require('axios');
const path = require('path');
const { Document, Packer, Paragraph, TextRun } = require('docx');

// Helper function to extract text from HTML
function extractTextFromHtml(html) {
    try {
        // Simple HTML to text conversion
        let text = html
            .replace(/<[^>]*>/g, ' ') // Remove HTML tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
            .replace(/&amp;/g, '&') // Replace HTML entities
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
        
        // Limit text length to avoid huge documents
        if (text.length > 10000) {
            text = text.substring(0, 10000) + '... [content truncated]';
        }
        
        return text;
    } catch (error) {
        console.error('Error extracting text from HTML:', error);
        return 'Could not extract content from HTML file.';
    }
}

// Helper function to create DOCX from text content
async function createDocxFromText(textContent, fileName, fileTitle) {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    text: "Converted Document",
                    heading: "Heading1"
                }),
                new Paragraph({
                    children: [
                        new TextRun(`Original file: ${fileName}`),
                        new TextRun({ text: "", break: 1 })
                    ]
                }),
                new Paragraph(""),
                new Paragraph({
                    text: "Content:",
                    heading: "Heading2"
                }),
                new Paragraph(""),
                new Paragraph({
                    children: [new TextRun(textContent)]
                })
            ]
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
    
    let fileTitle = "";
    if (req.query.id) {
        try {
            const dbPromise = require('../routes/dbPromise.config');
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

    try {
        // Parse Cloudinary URL
        const parsedUrl = new URL(fileUrl);
        const filePath = parsedUrl.pathname;
        let fileName = path.basename(filePath);

        // IMPORTANT: Cloudinary might be serving .auto files as raw/zip
        // We need to handle this case specifically
        const isCloudinaryAutoFile = fileName.toLowerCase().endsWith('.auto');
        
        // Fetch file from Cloudinary
        console.log(`Fetching file from Cloudinary: ${filePath}`);
        const response = await axios.get(`https://res.cloudinary.com${filePath}`, {
            responseType: 'arraybuffer',
            auth: {
                username: process.env.CLOUDINARY_API_KEY,
                password: process.env.CLOUDINARY_API_SECRET,
            },
        });

        let fileBuffer = Buffer.from(response.data);
        
        // Determine final filename
        let finalFileName = filenameFromQuery || fileName;
        
        // Always convert .auto to .docx for the response
        if (isCloudinaryAutoFile) {
            console.log(`Processing Cloudinary .auto file: ${fileName}`);
            finalFileName = finalFileName.replace(/\.auto$/i, '.docx');
            
            // Try to determine what type of content this is
            let textContent = '';
            
            try {
                // First, try to see if it's text/HTML
                const fileContent = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 5000));
                
                // Check if it looks like HTML
                const isHtml = fileContent.includes('<html') || 
                              fileContent.includes('<!DOCTYPE') || 
                              fileContent.includes('<body') ||
                              fileContent.includes('XHTML') ||
                              fileContent.includes('<p>') ||
                              fileContent.includes('<div>');
                
                if (isHtml) {
                    console.log('Detected HTML content in .auto file');
                    // Get full content as string
                    const fullContent = fileBuffer.toString('utf8');
                    textContent = extractTextFromHtml(fullContent);
                } else {
                    // Check if it's a ZIP file (common for Cloudinary .auto files)
                    const isZip = fileBuffer.slice(0, 4).toString('hex') === '504b0304'; // ZIP magic bytes
                    
                    if (isZip) {
                        console.log('Detected ZIP content in .auto file');
                        
                        // Try to extract text from ZIP
                        const AdmZip = require('adm-zip');
                        try {
                            const zip = new AdmZip(fileBuffer);
                            const zipEntries = zip.getEntries();
                            
                            // Look for text files in the ZIP
                            const textFiles = zipEntries.filter(entry => 
                                !entry.isDirectory && 
                                (entry.entryName.toLowerCase().endsWith('.txt') ||
                                 entry.entryName.toLowerCase().endsWith('.text') ||
                                 entry.entryName.toLowerCase().endsWith('.xml') ||
                                 entry.entryName.toLowerCase().endsWith('.html') ||
                                 entry.entryName.toLowerCase().endsWith('.htm'))
                            );
                            
                            if (textFiles.length > 0) {
                                console.log(`Found ${textFiles.length} text files in ZIP`);
                                
                                // Create a DOCX with all text files
                                const doc = new Document({
                                    sections: [{
                                        properties: {},
                                        children: [
                                            new Paragraph({
                                                text: "Archive Contents",
                                                heading: "Heading1"
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun(`Original .auto file: ${fileName}`),
                                                    new TextRun({ text: "", break: 1 }),
                                                    new TextRun(`Contains ${textFiles.length} file(s):`)
                                                ]
                                            }),
                                            new Paragraph("")
                                        ]
                                    }]
                                });
                                
                                // Add each text file
                                textFiles.forEach((entry, index) => {
                                    let entryContent = '';
                                    try {
                                        entryContent = entry.getData().toString('utf8');
                                        
                                        // Clean up content if it's HTML
                                        if (entry.entryName.toLowerCase().endsWith('.html') || 
                                            entry.entryName.toLowerCase().endsWith('.htm') ||
                                            entry.entryName.toLowerCase().endsWith('.xml')) {
                                            entryContent = extractTextFromHtml(entryContent);
                                        }
                                        
                                        // Limit content length
                                        if (entryContent.length > 5000) {
                                            entryContent = entryContent.substring(0, 5000) + '... [content truncated]';
                                        }
                                        
                                        doc.addSection({
                                            children: [
                                                new Paragraph({
                                                    text: `${index + 1}. ${entry.entryName}`,
                                                    heading: "Heading3"
                                                }),
                                                new Paragraph(entryContent),
                                                new Paragraph("") // Empty line
                                            ]
                                        });
                                    } catch (entryError) {
                                        console.warn(`Could not process ${entry.entryName}:`, entryError.message);
                                        doc.addSection({
                                            children: [
                                                new Paragraph({
                                                    text: `${index + 1}. ${entry.entryName} (could not read)`,
                                                    heading: "Heading3"
                                                }),
                                                new Paragraph("Unable to read file content"),
                                                new Paragraph("")
                                            ]
                                        });
                                    }
                                });
                                
                                const docxBuffer = await Packer.toBuffer(doc);
                                fileBuffer = docxBuffer;
                            } else {
                                // No text files found in ZIP
                                textContent = `This .auto file is a ZIP archive containing:\n\n`;
                                zipEntries.forEach((entry, index) => {
                                    const type = entry.isDirectory ? '📁 Directory' : '📄 File';
                                    textContent += `${index + 1}. ${type}: ${entry.entryName}\n`;
                                });
                                
                                const docxBuffer = await createDocxFromText(textContent, fileName, fileTitle);
                                fileBuffer = docxBuffer;
                            }
                        } catch (zipError) {
                            console.warn('Failed to process as ZIP:', zipError.message);
                            // Fall back to treating as plain text
                            textContent = fileBuffer.toString('utf8');
                            if (textContent.length > 10000) {
                                textContent = textContent.substring(0, 10000) + '... [content truncated]';
                            }
                            const docxBuffer = await createDocxFromText(textContent, fileName, fileTitle);
                            fileBuffer = docxBuffer;
                        }
                    } else {
                        // Not HTML, not ZIP - treat as plain text
                        console.log('Treating .auto file as plain text');
                        textContent = fileBuffer.toString('utf8');
                        if (textContent.length > 10000) {
                            textContent = textContent.substring(0, 10000) + '... [content truncated]';
                        }
                        const docxBuffer = await createDocxFromText(textContent, fileName, fileTitle);
                        fileBuffer = docxBuffer;
                    }
                }
            } catch (error) {
                console.error('Error processing .auto file:', error.message);
                // Create error DOCX
                const errorDoc = new Document({
                    sections: [{
                        properties: {},
                        children: [
                            new Paragraph({
                                text: "Error Processing File",
                                heading: "Heading1"
                            }),
                            new Paragraph(`Could not process .auto file: ${fileName}`),
                            new Paragraph("Please re-upload this file."),
                            new Paragraph(`Error: ${error.message}`)
                        ]
                    }]
                });
                
                fileBuffer = await Packer.toBuffer(errorDoc);
            }
        }
        
        // For non-.auto files, use the file as-is
        else {
            console.log(`Processing regular file: ${fileName}`);
            
            // Set final filename based on database title if available
            if (!filenameFromQuery && fileTitle) {
                const baseTitle = fileTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const extension = path.extname(fileName);
                finalFileName = `${baseTitle}${extension}`;
            }
        }

        // Set response headers
        const encodedFilename = encodeURIComponent(finalFileName);
        const shouldDownload = download === 'true' || download === '1' || isCloudinaryAutoFile;
        
        res.setHeader('Content-Disposition', 
            shouldDownload 
                ? `attachment; filename="${finalFileName}"; filename*=UTF-8''${encodedFilename}`
                : 'inline');
        
        // Always serve .auto files as DOCX
        if (isCloudinaryAutoFile) {
            res.setHeader('Content-Type', 
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        } else {
            // For regular files, try to detect content type
            const fileType = require('file-type');
            const detectedType = await fileType.fromBuffer(fileBuffer);
            if (detectedType) {
                res.setHeader('Content-Type', detectedType.mime);
            } else {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
        }
        
        console.log(`Serving: ${finalFileName} as ${res.getHeader('Content-Type')}`);
        
        return res.send(fileBuffer);

    } catch (error) {
        console.error('Error processing file:', error.message);
        
        // Try to send error as DOCX
        try {
            const errorDoc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            text: "Error Processing File",
                            heading: "Heading1"
                        }),
                        new Paragraph("There was an error processing your file."),
                        new Paragraph(`URL: ${fileUrl}`),
                        new Paragraph(`Error: ${error.message}`),
                        new Paragraph("Please try again or contact support.")
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