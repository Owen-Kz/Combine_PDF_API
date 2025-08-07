const multer = require("multer");
const axios = require("axios");
const { config } = require("dotenv");
config();
const upload = multer();
const uploadAnnouncement = async (req,res) => {
    console.log("Uploading announcement...");
    upload.none()(req, res, async (err) => {
    try {
        const { title, content, priority, verifyCode } = req.body;

        if (!title || !content || !priority || !verifyCode) {
            return res.status(400).json({
                status: "error",
                message: "All fields are required"
            });
        }

        const response = await axios.post(`${process.env.ASFIRJ_API_URL}/announcement/upload.php`, {
            title,
            content,
            priority,
            verifyCode,
            adminEmail:req.user.email
        }, {
            headers: {
                "Content-Type": "application/json",
            }
        });



        if (response.status !== 200 || response.data.error) {
            throw new Error("Failed to upload announcement");
        }

        return res.json({
            status: "success",
            message: "Announcement uploaded successfully"
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
            error: error.message
        });
    }
})
}

module.exports = uploadAnnouncement;