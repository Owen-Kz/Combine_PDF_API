const axios = require("axios");
const mime = require("mime-types"); // Import mime-types for file type detection

const downloadExternal = async (req, res) => {
    try {
        const { fileName } = req.params;

        console.log("ASFI_SCHOLAR URL:", process.env.ASFI_SCHOLAR);
        console.log("Requested File:", fileName);
        console.log(`Fetching: ${process.env.ASFI_SCHOLAR}/manuscripts/${fileName}`);

        // Fetch the file from the external server
        const response = await axios.get(`${process.env.ASFI_SCHOLAR}/manuscripts/${fileName}`, {
            responseType: "arraybuffer",
            timeout: 15000,
        });

        // Convert response data to buffer
        let fileBuffer = Buffer.from(response.data);
        if(fileBuffer){
        

        // Detect content type based on file extension
        const contentType = mime.lookup(fileName) || "application/octet-stream";

        // Set headers for file download
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Type", contentType);

        // Send file as response
        res.send(fileBuffer);
        const responseDelete = await fetch(`${process.env.ASFI_SCHOLAR}/deleteFileAPI`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({file:fileName})
        });
        
        const responseDataDelete = await responseDelete.json(); 
       console.log(responseDataDelete)
    }else{
        return res.json({ url: `/combineFiles?status=error&message=${encodeURIComponent("No valid files found")}&tag=Invalid Files` });
    }
    } catch (error) {
        console.error("Download Error:", error.message);
        
        return res.status(500).json({ error: error.message });
    }
};

module.exports = downloadExternal;
