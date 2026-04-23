const writeCookie = (req,res,cookieName, cookieValue) =>{

    const cookieOptions = {
        expiresIn: new Date(Date.now() + process.env.COOKIE_EXPIRES * 24 * 60 * 60 * 1000),
        httpOnly: false,
        sameSite: false,
        }
        // console.log(cookieName, cookieValue)
        res.cookie(cookieName, cookieValue, cookieOptions)
}


module.exports = writeCookie