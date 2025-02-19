const db = require("../../routes/db.config")

const getSubmissionAuthors = async (req,res) =>{
    try{
     const {articleID} = req.query

     db.query("SELECT * FROM submission_authors WHERE submission_id = ? ", [articleID], (error, results) => {
         if (error) {
             return res.status(500).json({ error: error.message, authorsList:[] });
         }

         if (results.length > 0) {
             return res.json({ success: "Authors Available", authorsList: results });
         } else {
             return res.json({ success: "No authors have been suggested", authorsList:[] });
         }
     })
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}


module.exports = getSubmissionAuthors