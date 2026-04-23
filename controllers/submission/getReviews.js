// backend/controllers/editors/getReviews.js
const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");

const getReviews = async (req, res) => {
    try {
        const { articleID } = req.query;
        
        if (!articleID) {
            return res.status(400).json({ error: "Article ID is required" });
        }
        
        console.log("Fetching reviews for article:", articleID);

        // Use LEFT JOIN to get reviewer details in a single query
        const query = `
            SELECT 
                r.*,
                CONCAT_WS(' ', 
                    a.prefix, 
                    a.firstname, 
                    a.lastname
                ) as reviewer_name,
                a.orcid_id,
                a.affiliations,
                a.affiliation_country,
                a.affiliation_city,
                CASE 
                    WHEN a.email IS NOT NULL THEN TRUE 
                    ELSE FALSE 
                END as has_profile
            FROM reviews r
            LEFT JOIN authors_account a ON r.reviewer_email = a.email
            WHERE r.article_id = ? AND r.review_status = 'review_submitted'
            ORDER BY r.id DESC
        `;

        const [reviews] = await dbPromise.query(query, [articleID]);

        if (!reviews || reviews.length === 0) {
            return res.json({ 
                success: "No reviews found", 
                reviews: [],
                message: "No reviews have been submitted for this article"
            });
        }

        // Process results to clean up null values and add fallbacks
        const processedReviews = reviews.map(review => ({
            ...review,
            reviewer_name: review.reviewer_name?.trim() || 
                          (review.reviewer_email ? review.reviewer_email.split('@')[0].replace(/[._]/g, ' ') : 'Anonymous Reviewer'),
            reviewer_info: {
                orcid_id: review.orcid_id,
                affiliation: review.affiliations,
                country: review.affiliation_country,
                city: review.affiliation_city
            }
        }));

        console.log(`Successfully retrieved ${processedReviews.length} reviews`);
        
        return res.json({ 
            success: "Review Available", 
            reviews: processedReviews,
            count: processedReviews.length
        });

    } catch (error) {
        console.error("Error in getReviews:", error);
        return res.status(500).json({ 
            error: "Failed to fetch reviews", 
            message: error.message 
        });
    }
};

module.exports = getReviews;