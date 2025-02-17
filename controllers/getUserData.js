const db = require("../routes/db.config")

const getUserData = async (req,res, next) =>{
    try{
        const userID = req.query._uid

        db.query("SELECT * FROM authors_account WHERE email = ? OR md5(id) = ?",[userID, userID], async(error, data) =>{
            if(error){
                console.log(error)
                return res.json({error:error})
            }else if(data[0]){
               req.user = data[0]
               const cookieOptions = {
                expiresIn: new Date(Date.now() + process.env.COOKIE_EXPIRES * 24 * 60 * 60 * 1000),
                httpOnly: false,
                sameSite: false,
                }
                res.cookie("_uem", req.user.email, cookieOptions)
                next()
            }else{
                req.user = []
                if(req.cookies._sessionID){
                req._articleId = req.cookies._sessionID
                }else{
                    req._articleId = ""
                }
                next()
            }
        })
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }

}

module.exports = getUserData