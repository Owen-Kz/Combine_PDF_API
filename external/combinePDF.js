const { PDFDocument } = require('pdf-lib');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const axios = require('axios');
const AdmZip = require('adm-zip');
const dbPromise = require('../routes/dbPromise.config');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = require('docx');

// Increase timeout and add retry logic
const axiosInstance = axios.create({
  timeout: 120000, // 2 minutes timeout
  maxContentLength: 100 * 1024 * 1024, // 100MB max
  maxBodyLength: 100 * 1024 * 1024
});

// Add retry interceptor
axiosInstance.interceptors.response.use(undefined, async (err) => {
  const { config, message } = err;
  
  if (message.includes('timeout') && (!config || !config.retryCount)) {
    config.retryCount = config.retryCount || 0;
    
    if (config.retryCount < 3) {
      config.retryCount += 1;
      console.log(`Retrying download (attempt ${config.retryCount}/3)...`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      return axiosInstance(config);
    }
  }
  
  return Promise.reject(err);
});

const upload = multer({ dest: 'uploads/' }).fields([
  { name: 'manuscript_file', maxCount: 1 },
  { name: 'tracked_manuscript', maxCount: 1 },
  { name: 'figures', maxCount: 10 },
  { name: 'supplementary_material', maxCount: 1 },
  { name: 'graphic_abstract', maxCount: 1 },
  { name: 'tables', maxCount: 10 }
]);

const downloadFileFromUrl = async (fileUrl, localPath, retryCount = 0) => {
  try {
    console.log(`Downloading file from: ${fileUrl}`);
    
    const response = await axiosInstance({
      method: 'get',
      url: fileUrl,
      responseType: 'arraybuffer',
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Download progress: ${percentCompleted}%`);
        }
      }
    });
    
    fs.writeFileSync(localPath, Buffer.from(response.data));
    console.log(`File downloaded successfully: ${localPath} (${response.data.length} bytes)`);
    return localPath;
  } catch (error) {
    console.error(`Error downloading file (attempt ${retryCount + 1}/3):`, error.message);
    
    if (retryCount < 3) {
      console.log(`Retrying download in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return downloadFileFromUrl(fileUrl, localPath, retryCount + 1);
    }
    
    throw new Error(`Failed to download file after 3 attempts: ${error.message}`);
  }
};

// Check if file is a zip containing Word document
const isWordDocumentZip = (filePath) => {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    
    const hasWordDocument = entries.some(entry => 
      entry.entryName === 'word/document.xml' || 
      entry.entryName.includes('word/document.xml')
    );
    
    return hasWordDocument;
  } catch (error) {
    return false;
  }
};

// Extract Word document from zip and save as .docx
const extractWordFromZip = async (zipPath, outputDocxPath) => {
  try {
    console.log(`Extracting Word from zip: ${zipPath}`);
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    
    const documentEntry = entries.find(entry => 
      entry.entryName === 'word/document.xml' || 
      entry.entryName.includes('word/document.xml')
    );
    
    if (!documentEntry) {
      throw new Error('No Word document found in zip');
    }
    
    const newZip = new AdmZip();
    
    entries.forEach(entry => {
      if (entry.entryName.startsWith('word/') || 
          entry.entryName.startsWith('_rels/') || 
          entry.entryName.startsWith('docProps/') ||
          entry.entryName === '[Content_Types].xml') {
        newZip.addFile(entry.entryName, entry.getData());
      }
    });
    
    newZip.writeZip(outputDocxPath);
    console.log(`Extracted Word document to: ${outputDocxPath}`);
    return outputDocxPath;
  } catch (error) {
    console.error('Error extracting Word from zip:', error);
    throw error;
  }
};

// Extract text from DOCX using mammoth
const extractTextFromDocx = async (docxPath) => {
  try {
    console.log(`Extracting text from DOCX: ${docxPath}`);
    const result = await mammoth.extractRawText({ path: docxPath });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw error;
  }
};

// Convert PDF to DOCX with basic text extraction
const convertPDFToDOCX = async (pdfPath, outputDocxPath) => {
  try {
    console.log(`Converting PDF to DOCX: ${pdfPath}`);
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const children = [
      new Paragraph({
        children: [
          new TextRun({
            text: "Converted PDF Document",
            bold: true,
            size: 32
          })
        ],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    ];

    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `--- Page ${i + 1} ---`,
              bold: true,
              size: 24
            })
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
          children: [
            new TextRun(`[Content from page ${i + 1} - PDF text extraction limited]`)
          ],
          spacing: { after: 200 }
        })
      );
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputDocxPath, buffer);
    console.log(`PDF converted to DOCX: ${outputDocxPath}`);
    return outputDocxPath;
  } catch (error) {
    console.error('Error converting PDF to DOCX:', error);
    throw error;
  }
};

// Merge DOCX files by extracting text and creating a new document
const mergeDOCXFiles = async (docxPaths, outputFilePath) => {
  try {
    console.log(`Merging ${docxPaths.length} DOCX files...`);
    
    const children = [];

    for (let i = 0; i < docxPaths.length; i++) {
      const docxPath = docxPaths[i];
      
      try {
        // Add document separator
        if (i > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "",
                  break: 1
                })
              ]
            })
          );
        }

        // Add document header
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Document ${i + 1}`,
                bold: true,
                size: 28
              })
            ],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 }
          })
        );

        // Extract and add document content
        const text = await extractTextFromDocx(docxPath);
        
        // Split text into paragraphs and add them
        const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
        
        paragraphs.forEach(paraText => {
          children.push(
            new Paragraph({
              children: [
                new TextRun(paraText.trim())
              ],
              spacing: { after: 200 }
            })
          );
        });

        console.log(`Added content from document ${i + 1}`);
      } catch (error) {
        console.error(`Error processing DOCX file ${docxPath}:`, error);
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[Error loading document ${i + 1}]`,
                italics: true
              })
            ],
            spacing: { after: 200 }
          })
        );
      }
    }

    // Create the merged document
    const doc = new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });

    // Generate the document buffer
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputFilePath, buffer);
    
    console.log(`Merged DOCX saved to: ${outputFilePath}`);
    return outputFilePath;
  } catch (error) {
    console.error('Error merging DOCX files:', error);
    throw error;
  }
};

// Alternative approach using mammoth to convert to HTML and then to DOCX
const mergeDOCXFilesWithMammoth = async (docxPaths, outputFilePath) => {
  try {
    console.log(`Merging ${docxPaths.length} DOCX files using mammoth...`);
    
    let combinedHtml = '<html><body>';
    
    for (let i = 0; i < docxPaths.length; i++) {
      const docxPath = docxPaths[i];
      
      try {
        // Convert DOCX to HTML
        const result = await mammoth.convertToHtml({ path: docxPath });
        
        // Add document separator
        if (i > 0) {
          combinedHtml += '<hr style="page-break-before: always;" />';
        }
        
        // Add document header
        combinedHtml += `<h1 style="text-align: center;">Document ${i + 1}</h1>`;
        
        // Add document content
        combinedHtml += result.value;
        
        console.log(`Added content from document ${i + 1}`);
      } catch (error) {
        console.error(`Error processing DOCX file ${docxPath}:`, error);
        combinedHtml += `<p><i>Error loading document ${i + 1}</i></p>`;
      }
    }
    
    combinedHtml += '</body></html>';
    
    // Convert HTML back to DOCX using mammoth's HTML to DOCX (requires additional library)
    // For now, we'll use a simple approach with docx
    
    // Use the simpler merge approach instead
    return await mergeDOCXFiles(docxPaths, outputFilePath);
    
  } catch (error) {
    console.error('Error merging DOCX files with mammoth:', error);
    throw error;
  }
};

const cleanUpFiles = (files) => {
  files.forEach((filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up: ${filePath}`);
      } catch (err) {
        console.error(`Error cleaning up file: ${filePath}`, err.message);
      }
    }
  });
};

const getFileUrlsFromSubmission = (submission) => {
  const fileUrls = [];
  const fileFields = [
    'manuscript_file',
    'tracked_manuscript_file',
    'cover_letter_file',
    'tables',
    'figures',
    'graphic_abstract',
    'supplementary_material',
    'document_file'
  ];

  fileFields.forEach(field => {
    if (submission[field]) {
      fileUrls.push({
        url: submission[field],
        type: field,
        isCloudinary: submission[field].includes('cloudinary.com') || submission.is_old_submission === 'yes'
      });
    }
  });

  return fileUrls;
};

const CombineWordDocuments = async (req, res) => {
  const { revisionId } = req.body;

  if (!revisionId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Revision ID is required' 
    });
  }

  try {
    // Get submission data from database
    const [submissions] = await dbPromise.query(
      "SELECT * FROM submissions WHERE revision_id = ?", 
      [revisionId]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Submission not found' 
      });
    }

    const submission = submissions[0];
    const isOldSubmission = submission.is_old_submission === 'yes';
    
    console.log(`Processing files for submission: ${revisionId}`);
    console.log(`Submission type: ${isOldSubmission ? 'Old (Cloudinary)' : 'New (Local)'}`);

    // Get all file URLs from the submission
    const fileUrls = getFileUrlsFromSubmission(submission);
    
    if (fileUrls.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No files found for this submission' 
      });
    }

    console.log(`Found ${fileUrls.length} files to process`);

    const downloadedFiles = [];
    const docxFiles = [];

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Download and process each file
    for (let i = 0; i < fileUrls.length; i++) {
      const fileInfo = fileUrls[i];
      const fileUrl = fileInfo.url;
      const fileType = fileInfo.type;
      
      console.log(`Processing file ${i + 1}/${fileUrls.length}: ${fileType} - ${fileUrl}`);

      // Skip dummy files
      if (fileUrl.toLowerCase().includes('dummy')) {
        console.log(`Skipping dummy file: ${fileUrl}`);
        continue;
      }

      try {
        // Determine file extension from URL
        const urlParts = fileUrl.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0];
        let fileExtension = path.extname(fileName).toLowerCase();
        
        // Handle Cloudinary URLs that might have .auto extension or no extension
        if (!fileExtension || fileExtension === '.auto' || fileExtension === '') {
          // Try to determine from URL path or default to .docx
          if (fileUrl.includes('.pdf')) {
            fileExtension = '.pdf';
          } else if (fileUrl.includes('.docx') || fileUrl.includes('.doc')) {
            fileExtension = '.docx';
          } else {
            fileExtension = '.docx'; // Default to docx
          }
        }
        
        // Create local temp file path
        const tempFileName = `${revisionId}_${fileType}_${Date.now()}_${i}${fileExtension}`;
        const tempFilePath = path.join(uploadsDir, tempFileName);

        // Download the file with retry logic
        await downloadFileFromUrl(fileUrl, tempFilePath);
        downloadedFiles.push(tempFilePath);

        // Check if it's a zip containing Word document
        let docxPath = tempFilePath;
        if (fileExtension === '.zip' || isWordDocumentZip(tempFilePath)) {
          console.log(`File appears to be a zip containing Word document. Extracting...`);
          const extractedDocxPath = tempFilePath.replace(/\.(zip|auto)$/, '.docx');
          await extractWordFromZip(tempFilePath, extractedDocxPath);
          docxPath = extractedDocxPath;
          downloadedFiles.push(extractedDocxPath);
          fileExtension = '.docx';
          console.log(`Extracted to: ${extractedDocxPath}`);
        }

        // Add to DOCX files list if it's a Word document or PDF
        if (fileExtension === '.docx' || fileExtension === '.doc' || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
          docxFiles.push(docxPath);
          console.log(`Added DOCX file: ${docxPath}`);
        } else if (fileExtension === '.pdf' || fileName.endsWith('.pdf')) {
          // Convert PDF to DOCX
          console.log(`Converting PDF to DOCX: ${fileName}`);
          const convertedDocxPath = tempFilePath.replace(/\.pdf$/, '.docx');
          await convertPDFToDOCX(tempFilePath, convertedDocxPath);
          downloadedFiles.push(convertedDocxPath);
          docxFiles.push(convertedDocxPath);
          console.log(`Converted to: ${convertedDocxPath}`);
        } else {
          console.log(`Skipping unsupported file type: ${fileExtension} for ${fileName}`);
        }
      } catch (error) {
        console.error(`Error processing file ${fileUrl}:`, error.message);
        // Continue with next file instead of failing completely
        continue;
      }
    }

    if (docxFiles.length === 0) {
      cleanUpFiles(downloadedFiles);
      return res.status(400).json({ 
        success: false, 
        message: 'No valid DOCX files could be processed' 
      });
    }

    // Merge DOCX files
    console.log(`Merging ${docxFiles.length} DOCX files...`);
    const outputFileName = `${revisionId}_combined_${Date.now()}.docx`;
    const outputFilePath = path.join(uploadsDir, outputFileName);
    
    await mergeDOCXFiles(docxFiles, outputFilePath);

    // Verify the file was created and has content
    if (!fs.existsSync(outputFilePath)) {
      throw new Error('Combined file was not created');
    }

    const stats = fs.statSync(outputFilePath);
    if (stats.size === 0) {
      throw new Error('Combined file is empty');
    }

    console.log(`Combined file created successfully: ${outputFilePath} (${stats.size} bytes)`);

    // Create a download URL for the combined file
    const combinedFileUrl = `${req.protocol}://${req.get('host')}/uploads/${outputFileName}`;

    // Clean up temporary files (but keep the combined file)
    console.log('Cleaning up temporary files...');
    cleanUpFiles(downloadedFiles);

    const response = {
      success: true,
      message: 'Word documents combined successfully',
      fileCount: docxFiles.length,
      combinedFile: combinedFileUrl,
      filename: outputFileName,
      fileSize: stats.size,
      isOldSubmission
    };

    console.log('Processing complete. Combined file URL:', combinedFileUrl);
    res.json(response);

  } catch (error) {
    console.error('Error processing files:', error);
    
    // Clean up any temporary files in case of error
    if (downloadedFiles) {
      cleanUpFiles(downloadedFiles);
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error processing files' 
    });
  }
};

module.exports = CombineWordDocuments;