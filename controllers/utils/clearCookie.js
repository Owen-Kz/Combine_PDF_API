const clearCookie = (req,res,cookieName) => {
    try{
    res.clearCookie(cookieName)
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}

module.exports = clearCookie