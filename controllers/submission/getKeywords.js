const getSubmisionKeywords = async (req,res) =>{
try{
    const submissionID = req.body.article_id;
    if(!submissionID){
        return res.json({error:"couldNotGetKeywords",keywords:[]})
    }
    const query = `
    SELECT *
    FROM submission_keywords 
    WHERE article_id = ?
    `;
    db.query(query,[submissionID],(error,results)=>{
        if(error){
            console.log(error)
            return res.status(500).json({error:"Database error",message:error.message})
        }
        const keywords = results.map((result) => result.keyword);
        return res.json({success:"gotKeywords",keywords:results})
    })
}catch(error){
    return res.json({error:error.message})
}
}

module.exports = getSubmisionKeywords