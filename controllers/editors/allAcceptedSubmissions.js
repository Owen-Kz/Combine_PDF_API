const db = require("../../routes/db.config")
const isAdminAccount = require("./isAdminAccount")

const allAcceptedSubmissions = async (req,res) =>{
try{
    if(req.cookies.userRegistered){
    const id = req.user.id
    const page = req.query.page ? parseInt(req.query.page) : 1; // Default to page 1
    const pageSize = 5; // Number of records per page
    const offset = (page - 1) * pageSize;


    if(await isAdminAccount(id)){
    db.query(`WITH RankedSubmissions AS (
                    SELECT 
                        s.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY s.article_id 
                            ORDER BY s.revision_id DESC, s.process_start_date DESC
                        ) AS row_num
                    FROM submissions s
                    WHERE s.title != '' AND status = 'Accepted'
                )
                SELECT *
                FROM RankedSubmissions
                WHERE row_num = 1
                ORDER BY process_start_date DESC LIMIT ? OFFSET ?;`, 
                [pageSize, offset], async(error, data) =>{
                    if(error){
                        console.log(error)
                        return res.json({error:error})
                    }
                    if(data[0]){
                        return res.json({success:"Admin Account",  submissions:data})
                    }else{
                   
                        return res.json({success:"Admin Account",  submissions:data})
                    }
                })

    }else{
        console.log("NOT ADMIN")
        return res.json({error:"Not ADmin"})
    }
}else{
    console.log("user not logged in")
   return res.json({error:"user not logged in"})
}
}catch(error){
    console.log(error)
    return res.json({error:error.message})
}
}


module.exports = allAcceptedSubmissions