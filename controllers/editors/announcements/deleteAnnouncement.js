const axios = require("axios")
const { config } = require("dotenv")
config()
const multer = require("multer")
const upload = multer()
const deleteAnnouncement = async (req, res) =>{
        upload.none()(req, res, async (err) => {
try{
    const {id, verifyCode} = req.body 
    console.log(req.body)
 
    if(!id || !verifyCode){
        return res.json({error:"All Fields are required"})
    }
    
                const response = await axios.post(`${process.env.ASFIRJ_API_URL}/announcement/delete.php`, {
                    id,
                    verifyCode,
                }, {
                    headers: {
                        "Content-Type": "application/json",
                    }
                });
    
                console.log("Response from API:", response.data);
    
                if (response.status !== 200 || response.data.error) {
                    throw new Error("Failed to delete announcement");
                }
    
                return res.json({
                    status: "success",
                    success: "Announcement deleted successfully"
                });
}catch(error) {
    console.log(error)
    return res.json({error:error.message??error})
}
        })
}

module.exports = deleteAnnouncement