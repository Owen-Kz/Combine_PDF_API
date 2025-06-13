const db = require("../routes/db.config");
const dbPromise = require("../routes/dbPromise.config");

const generateArticleId = async (req, res) => {
    try {
    
        return new Promise((resolve, reject) => {
                  if(!req.user || !req.user.id){
            console.log('Invalid Session')
            return reject({error:"Session is Not Valid, please login again"})
        }
            db.query("SELECT id FROM `submissions` WHERE id = (SELECT MAX(id) FROM `submissions`)", 
            (err, rows) => {
                if (err) {
                    console.error("Error generating article id:", err);
                    return reject(err);
                }

                // Generate article ID
                let submissionsCount;
                if (rows.length > 0) {
                    const countSub = Number(rows[0].id) + 1;
                    submissionsCount = String(countSub).padStart(6, '0');
                } else {
                    submissionsCount = "000001";
                }

                const articleID = `ASFIRJ-${new Date().getFullYear()}-${submissionsCount}`;
                
                // // Initialize session data
                // req.session.manuscriptData = {
                //     sessionID: articleID,
                //     manFile: false,
                //     covFile: false,
                //     abstract: null,
                //     files: {
                //         manuscript: null,
                //         coverLetter: null,
                //         tables: null,
                //         figures: null,
                //         graphicAbstract: null,
                //         supplement: null,
                //         trackedFile: null
                //     },
                //     existingFiles: {
                //         manuscript: null,
                //         coverLetter: null,
                //         tables: null,
                //         figures: null,
                //         graphicAbstract: null,
                //         supplement: null,
                //         trackedFile: null
                //     },
                //     keyCount: 0,
                //     process: null
                // };

                console.log("Generated new article ID:", articleID);
                resolve(articleID);
            });
        });
    } catch (error) {
        console.error("System error generating article ID:", error);
        throw error;
    }
};

module.exports = generateArticleId;