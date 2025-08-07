const multer = require("multer");
const axios = require("axios");
const { config } = require("dotenv");
config();
const upload = multer()

const editAnnouncement = async (req,res) =>{
    console.log("Editing announcement...");
    upload.none()(req, res, async (err) => {
        try {
            const { id, title, content, priority, verifyCode } = req.body;
          

            if (!id || !title || !content || !priority || !verifyCode) {
                return res.status(400).json({
                    status: "error",
                    message: "All fields are required"
                });
            }

            const response = await axios.post(`${process.env.ASFIRJ_API_URL}/announcement/edit.php`, {
                id,
                title,
                content,
                priority,
                verifyCode,
            }, {
                headers: {
                    "Content-Type": "application/json",
                }
            });

            console.log("Response from API:", response.data);

            if (response.status !== 200 || response.data.error) {
                throw new Error("Failed to edit announcement");
            }

            return res.json({
                status: "success",
                message: "Announcement edited successfully"
            });
        } catch (error) {
            console.log(error)
            return res.status(500).json({
                status: "error",
                message: "Internal Server Error",
                error: error.message
            });
        }
    })
}

module.exports = editAnnouncement;