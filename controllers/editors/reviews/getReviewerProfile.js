// backend/controllers/editors/getReviewerProfile.js
const db = require("../../../routes/db.config");

const getReviewerProfile = async (req, res) => {
    try {
        const { email } = req.params;

        
        const query = `
            SELECT 
                prefix,
                firstname,
                lastname,
                email,
                orcid_id,
                affiliations,
                affiliation_country,
                discipline
            FROM authors_account 
            WHERE email = ?
        `;
        
        db.query(query, [email], (error, results) => {
            if (error) {
                return res.status(500).json({ error: error.message });
            }
            
            if (results.length === 0) {
                return res.json({
                    success: true,
                    profile: {
                        name: email.split('@')[0],
                        email,
                        affiliation: 'Not specified'
                    }
                });
            }
            
            const reviewer = results[0];
            const name = [reviewer.prefix, reviewer.firstname, reviewer.lastname]
                .filter(Boolean)
                .join(' ');
            
            return res.json({
                success: true,
                profile: {
                    name: name || email.split('@')[0],
                    email: reviewer.email,
                    orcid: reviewer.orcid_id,
                    affiliation: reviewer.affiliations,
                    country: reviewer.affiliation_country,
                    discipline: reviewer.discipline
                }
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};

module.exports = getReviewerProfile;