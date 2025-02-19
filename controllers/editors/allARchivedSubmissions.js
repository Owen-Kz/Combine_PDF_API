const db = require("../../routes/db.config")
const isAdminAccount = require("./isAdminAccount")

const ArchivedSubmissions = async (req,res) =>{
try{
    const id = req.user.id
    if(await isAdminAccount(id)){
    

    db.query(`WITH RankedSubmissions AS (
                    SELECT 
                        s.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY s.article_id 
                            ORDER BY s.revision_id DESC, s.process_start_date DESC
                        ) AS row_num
                    FROM archived_submissions s
                    WHERE s.title != ''
                )
                SELECT *
                FROM RankedSubmissions
                WHERE row_num = 1
                ORDER BY process_start_date DESC;`, async(error, data) =>{
                    if(error){
                        console.log(error)
                        return res.json(error)
                    }
                    if(data){
                        return res.json({success:"Admin Account",  submissions:data})
                    }
                })

    }else{
        return res.json({error:"Not ADmin"})
    }
}catch(error){
    console.log(error)
    return res.json({error:error.message})
}
}


module.exports = ArchivedSubmissions