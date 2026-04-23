const combinedFilesPage = async (req,res) =>{
    try{
    const {status, message, tag, file, a} = req.query
    let filePath = ""
    let ArticleID = ""

    if(file){
        // file.substring(file.lastIndexOf("_") + 1) 
        filePath = file
    }
    if(a){
        ArticleID = a

    }
    
    return res.render("combineFiles", {status, message, tag, filePath: file, fileURL: file, ArticleID})
}catch(error){
    console.log(error)
    return res.json({error:error.message})
}

}

module.exports = combinedFilesPage