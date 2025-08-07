const axios = require("axios");
const { config } = require("dotenv");
config();
const getAnnouncements = async (req,res) =>{
    try{
console.log("Fetching announcements from API...");
        const response = await axios.get(`${process.env.ASFIRJ_API_URL}/announcement/retrieve.php`, {
            headers: {
                "Content-Type": "application/json",
            }
        });
        if (!response.data || response.status !== 200) {
            throw new Error("Failed to fetch announcements");
        }
        if (!Array.isArray(response.data)) {
            return res.status(500).json({
                status: "error",
                message: "Invalid response format from announcements API"
            });
        }

        return res.json({
            status: "success",
            announcements: response.data
        });
    }catch(error){
        console.log(error)
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
            error: error.message
        });
    }

}

module.exports = getAnnouncements