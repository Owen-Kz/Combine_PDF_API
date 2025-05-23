const dbPromise = require("../../../routes/dbPromise.config")

const getSubmisstionDetails = async (req,res) =>{
try{
    const id = req.query.a
    if(!id){
        return {error:"Invalid Parameters"}
    }
    const articleContent = await dbPromise.query("SELECT * FROM `submissions` WHERE `revision_id` = ?",[id])
    if(articleContent[0].length > 0){
        return {success:"content", article:articleContent[0][0]}
    }else{
        return {error:"content", article:[0]}

    }

}catch(error){
    console.log(error)
    return {error:error.message}
}
}


module.exports = getSubmisstionDetails