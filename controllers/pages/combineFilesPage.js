const combinedFilesPage = async (req,res) =>{
    try{
    const {status, message, tag, file} = req.query
    let filePath = ""
    let ArticleID = ""

    if(file){
        filePath = file
        ArticleID = file.substring(file.lastIndexOf("_") + 1) 
    }
    return res.render("combineFiles", {status, message, tag, filePath: file, fileURL: file, ArticleID})
}catch(error){
    console.log(error)
    return res.json({error:error.message})
}

}

module.exports = combinedFilesPage