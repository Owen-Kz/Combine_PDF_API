const axios = require('axios');
const { config } = require('dotenv');
config();
const getAnnouncementData = async (req,res) =>{
try{
    const announcementId = req.body.id;
    if (!announcementId) {
        return res.status(400).json({
            status: "error",
            message: "Announcement ID is required"
        });
    }
    const response = await axios.get(`${process.env.ASFIRJ_API_URL}/announcement/retrieveSingle.php?xid=${announcementId}`, {
        headers: {
            "Content-Type": "application/json",
        }
    });
    if (response.status !== 200 || !response.data) {
        return res.status(404).json({
            status: "error",
            message: "Announcement not found"
        });
    }
    return res.json({
        status: "success",
        announcement: response.data
    });
} catch (error) {
    console.error('Error fetching announcement data:', error);
    res.status(500).json({ message: 'Internal server error' });
}
}

module.exports = getAnnouncementData;