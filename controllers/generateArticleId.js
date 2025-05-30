const db = require("../routes/db.config");
const clearCookie = require("./utils/clearCookie");

const generateArticleId = async (req,res) => {
    try {
        return new Promise((resolve, reject) => {
            db.query("SELECT id FROM `submissions` WHERE id = (SELECT MAX(id) FROM `submissions`)", (err, rows) => {
                if (err) {
                    console.error("Error generating article id:", err);
                    return reject(err);
                }

                let submissionsCount;
                if (rows.length > 0) {
                    const countSub = new Number(rows[0].id) + 1;
                    if (countSub < 10) {
                        submissionsCount = `00000${countSub}`;
                    } else if (countSub < 100) {
                        submissionsCount = `0000${countSub}`;
                    } else if (countSub < 1000) {
                        submissionsCount = `000${countSub}`;
                    } else if (countSub < 10000) {
                        submissionsCount = `00${countSub}`;
                    } else {
                        submissionsCount = `0${countSub}`;
                    }
                } else {
                    submissionsCount = "000001";
                }

                const articleID = `ASFIRJ-${new Date().getFullYear()}-${submissionsCount}`;
                // console.log("Generated Article ID:", articleID);
                const cookieOptions = {
                    expiresIn: new Date(Date.now() + process.env.COOKIE_EXPIRES * 24 * 60 * 60 * 1000),
                    httpOnly: false
                    }
                    res.cookie("_sessionID", articleID, cookieOptions)
                    res.cookie("_manFile", 0, cookieOptions)
                    res.clearCookie("new_manuscript")
                    res.cookie("_covFile", 0, cookieOptions)
                    res.clearCookie("new_cover_letter")
                    res.clearCookie("new_tables")
                    res.clearCookie("new_figures")
                    res.clearCookie("new_graphic_abstract")
                    res.clearCookie("new_supplement")
                    res.clearCookie("new_tracked_file")
                    clearCookie(req, res, "__KeyCount")
                    clearCookie(req,res, "_process")
                    // clearCookie(req,res, "_covFile")
                    clearCookie(req,res, "exist_man")
                    clearCookie(req,res, "exist_cover")
                    clearCookie(req,res, "exist_tables")
                    clearCookie(req,res, "exist_figures")
                    clearCookie(req,res, "exist_graphic")
                    clearCookie(req,res, "exist_supplementary")
                    clearCookie(req,res, "exist_tracked")
                    
                    if(req.cookies._abstract){
                    res.clearCookie("_abstract")
                    }
               
                resolve(articleID);
            });
        });
    } catch (error) {
        console.error("Error generating article id:", error);
        throw error;
    }
};

module.exports = generateArticleId;
