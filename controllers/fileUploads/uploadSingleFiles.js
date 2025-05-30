require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const db = require("../../routes/db.config");
const clearCookie = require("../utils/clearCookie");
const writeCookie = require("../utils/writeCookie");


// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Storage Configuration (Temporary Storage)
const upload = multer({ dest: "uploads/" });

// Upload Route
const uploadSingleFile = (req,res) =>{
    try{

  
      console.log("uploads started")
      const FileField = req.params.field
   

     upload.single(FileField)(req, res, async (err) => {
        if (err) {
          console.error('Error during file upload:', err);
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'One or more files exceed the maximum allowed size of 5MB' });
          }
          return res.status(500).json({ error: 'File upload failed, One or more files exceed the maximum allowed size of 5MB'});
        }
      
    try {
        if (!req.file) {
            console.log("No file uploaded" )
        
            return res.status(400).json({ error: "No file uploaded" });
        }

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "asfirj/original", // Your preferred Cloudinary folder
            resource_type: "auto" // Auto-detect file type
        });
        console.log("Cloud upload")

        // Delete local file after upload
        fs.unlinkSync(req.file.path);
        console.log("file deleted")
        const cookieOptions = {
            expiresIn: new Date(Date.now() + process.env.COOKIE_EXPIRES * 24 * 60 * 60 * 1000),
            httpOnly: false
            }
        if(FileField === 'manuscript_file'){
            res.cookie("_manFile", 1, cookieOptions)
            clearCookie(req, res, "new_manuscript")
            clearCookie(req, res, "exist_man")

            res.cookie("new_manuscript", 1, cookieOptions)
            // req.session._manFile = 1;
            
            writeCookie(req, res, "exist_man", result.secure_url)
                            
        }

        if(FileField === "cover_letter_file"){
            res.cookie("_covFile", 1, cookieOptions)
            clearCookie(req, res, "new_cover_letter")
            clearCookie(req, res, "exist_cover")

            res.cookie("new_cover_letter", 1, cookieOptions)
            writeCookie(req, res, "exist_cover", result.secure_url)
                            
        }

        if(FileField === "tables"){
            clearCookie(req, res, "new_tables")
            clearCookie(req, res, "exist_tables")

            res.cookie("new_tables", 1, cookieOptions)
            writeCookie(req, res, "exist_tables", result.secure_url)
                            
        }

        if(FileField === "figures_file"){
            clearCookie(req, res, "new_figures")
            clearCookie(req, res, "exist_figures")

            res.cookie("new_figures", 1, cookieOptions)
            writeCookie(req, res, "exist_figures", result.secure_url)
                            
        }

        if(FileField === "graphic_abstract"){
            clearCookie(req, res, "new_graphic_abstract")
            clearCookie(req, res, "exist_graphic")

            res.cookie("new_graphic_abstract", 1, cookieOptions)
            writeCookie(req, res, "exist_graphic", result.secure_url)
                            
        }

        if(FileField === "supplementary_material"){
            clearCookie(req, res, "new_supplement")
            clearCookie(req, res, "exist_supplementary")

            res.cookie("new_supplement", 1, cookieOptions)
            writeCookie(req, res, "exist_supplementary", result.secure_url)
        }
        if(FileField === "tracked_manuscript_file"){
            clearCookie(req, res, "exist_tracked")
            clearCookie(req, res, "new_tracked_file")

            res.cookie("new_tracked_file", 1, cookieOptions)
            
            writeCookie(req, res, "exist_tracked", result.secure_url)

        }

        // Update the field 
        const articleId = req.cookies._sessionID
        
        db.query(`UPDATE submissions SET ${FileField} = ? WHERE revision_id = ?`, [result.secure_url, articleId], async (err, updated) =>{
            if(err){
                console.log(err)
                return res.json({error:err})
            }
            if(updated.affectedRows > 0){
               
                return res.json({ success: true, fileUrl: result.secure_url });
            }else{
                res.json({error:"Oops! Your file was not uploaded, please try again"})
            }
        } )
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: `File upload failed Plese check file size`, details: error.message });
    }
})
}catch(error){
    return res.json({error:error.message})
}
}

module.exports = uploadSingleFile;
