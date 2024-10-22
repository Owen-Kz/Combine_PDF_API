const fs = require('fs');
const path = require('path');
const multer = require('multer');
const officegen = require('officegen');
const axios = require('axios');
const FormData = require('form-data');




// Setup Multer for file uploads
const upload = multer({ dest: 'uploads/' }).fields([
    { name: 'manuscript_file', maxCount: 1 },
    { name: 'tracked_manuscript', maxCount: 1 },
    { name: 'figures', maxCount: 10 },
    { name: 'supplementary_material', maxCount: 1 },
    { name: 'graphic_abstract', maxCount: 1 },
    { name: 'tables', maxCount: 10 }
]);

const uploadCombinedPDFToPHPServer = async (combinedFilePath, combinedFilename) => {
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


// Function to merge DOCX files
const mergeDOCXFiles = async (docxPaths, outputFilePath) => {
    return new Promise((resolve, reject) => {
        const docx = officegen('docx');

        docx.on('finalize', function () {
            console.log('DOCX file has been created successfully.');
        });

        docx.on('error', function (err) {
            console.error('Error creating DOCX:', err);
            reject(err);
        });

        // Add each file's content to the final DOCX
        docxPaths.forEach((docxPath) => {
            const fileBuffer = fs.readFileSync(docxPath, 'utf8');
            docx.createP(fileBuffer); // Create a new paragraph for each DOCX file
        });

        // Generate the combined DOCX
        const output = fs.createWriteStream(outputFilePath);
        docx.generate(output);

        output.on('finish', () => resolve(outputFilePath));
        output.on('error', reject);
    });
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

            // Collect DOCX file paths to merge
            const docxPaths = [
                ...(manuscript_file || []).map(file => file.path),
                ...(tracked_manuscript || []).map(file => file.path),
                ...(figures || []).map(file => file.path),
                ...(supplementary_material || []).map(file => file.path),
                ...(graphic_abstract || []).map(file => file.path),
                ...(tables || []).map(file => file.path),
            ];

            // Merge DOCX files using officegen
            const combinedFilename = `combined-${Date.now()}.docx`;
            const combinedFilePath = path.join('uploads', combinedFilename);
            const combinedPdfBytes = await mergeDOCXFiles(docxPaths, combinedFilePath);
            
            fs.writeFileSync(combinedFilePath, combinedPdfBytes);

            console.log("File Combination Complete,", combinedFilename);

      
            // Upload the combined PDF to the PHP server
            await uploadCombinedPDFToPHPServer(combinedFilePath, combinedFilename);

            // Clean up temporary files
            cleanUpConvertedFiles(docxPaths);
            // Respond with success
           return res.json({ success: true, filename: combinedFilename });

        } catch (error) {
            console.error('Error combining DOCX files', error);
            res.status(500).json({ success: false, message: 'Error combining DOCX files' });
        }
    });
};

module.exports = CombineDOCX;
