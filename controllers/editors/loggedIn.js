
const jwt = require("jsonwebtoken");
const db = require("../../routes/db.config");
const writeCookie = require("../utils/writeCookie");

const EditorLoggedIn = async (req, res, next) => {
  // RestartConnection()
  if (!req.cookies.userRegistered) {
    // Redirect to home if user is not logged in
    if (req.path === '/becomeInstructor') {
        // Skip the middleware for the '/becomeInstructor' route
        return next();
      }else{
        return next();
    // return res.redirect("/"); 
      }
  }
 
  try {
    // Decrypt the cookie and retrieve user data with the id
  
    if(req.cookies.userRegistered){
       
    const decoded = jwt.verify(req.cookies.userRegistered, process.env.JWT_SECRET);
    

    db.query("SELECT id, fullname, email, editorial_level, editorial_section FROM editors WHERE id = ? ", [decoded.id], (err, result) => {
      if (err) {
        console.log(err);
        return res.redirect("/"); // Redirect to home on error
      }
      
      req.user = result[0];
      writeCookie(req,res, "editor_account_type", req.user.editorial_level)
      writeCookie(req,res, "editor", result[0].id)

      next();
    });
}else{
    return res.json({error:"Invalid Parameters"})
}

   

    // clearInterval(disconnectTimer);
  } catch (error) {
    console.log(error);
    next()
    // res.redirect("/editors/dashboard"); // Redirect to home on error
  }

};

module.exports = EditorLoggedIn;
