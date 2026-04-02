const { LogAction } = require("../Logger");
const { getClientIp } = require("../utils/getClientIp");
const db = require("./journal.db");
const express = require("express");
const router = express.Router()


router.get("/article-data", async (req, res) => {
    try {
        const { buffer } = req.query;
        
        // Validate buffer parameter
        if (!buffer || buffer.trim() === "") {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid request: Buffer parameter is required" 
            });
        }

        // Fetch article data from journals table
        const [articleData] = await db.query(
            `SELECT 
                id, 
                article_type, 
                manuscript_file, 
                cover_letter, 
                manuscript_tables, 
                figures, 
                supplimentary_materials, 
                graphic_abstract, 
                manuscript_full_title, 
                manuscript_running_title, 
                abstract_fr, 
                abstract_ptg,
                abstract_ar,
                abstract_background, 
                abstract_objectives, 
                abstract_method, 
                abstract_results, 
                abstract_discussion, 
                unstructured_abstract, 
                manuscriptPhoto, 
                status, 
                date_uploaded, 
                corresponding_authors_email, 
                buffer, 
                views_count, 
                downloads_count, 
                date_reviewed, 
                date_submitted, 
                date_accepted, 
                date_published, 
                is_editors_choice, 
                is_open_access, 
                hyperlink_to_others, 
                is_publication, 
                page_number, 
                doi_number, 
                issues_number, 
                is_old_publication 
            FROM journals 
            WHERE buffer = ? `, 
            [buffer]
        );

        // Check if article exists
        if (!articleData || articleData.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: "Article not found" 
            });
        }

        const article = articleData[0];

        // Fetch authors for this article
        const [authors] = await db.query(
            `SELECT authors_fullname, article_id, id 
             FROM authors 
             WHERE article_id = ? 
             ORDER BY id ASC`,
            [article.buffer]
        );

        // Process authors data
        const authorsList = authors.map(author => author.authors_fullname);
        const authorsTop = authorsList.join(", ");
        
        // Find corresponding author (if any)
        const correspondingAuthor = authorsList[0];
        const correspondingEmail = correspondingAuthor?.authors_fullname || article.corresponding_authors_email;

        // Format dates for display
        const formatDate = (date) => {
            if (!date) return null;
            return new Date(date).toLocaleDateString('en-US', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
            });
        };

        // Prepare structured response
        const responseData = {
            success: true,
            article: {
                // Basic info
                id: article.id,
                title: article.manuscript_full_title,
                runningTitle: article.manuscript_running_title,
                articleType: article.article_type,
                status: article.status,
                abstract_fr: article.abstract_fr || null,
                abstract_ptg: article.abstract_ptg || null,
                abstract_ar: article.abstract_ar || null,
                
                // Authors
                authorsList: authorsList,
                authorsTop: authorsTop,
                correspondingEmail: correspondingEmail,
                correspondingAuthor: correspondingAuthor?.authors_fullname || null,
                
                // Content
                abstract: article.unstructured_abstract || {
                    background: article.abstract_background,
                    objectives: article.abstract_objectives,
                    method: article.abstract_method,
                    results: article.abstract_results,
                    discussion: article.abstract_discussion
                },
                fullText: article.abstract_discussion,
                
                // Files
                manuscriptFile: article.manuscript_file,
                pdfUrl: article.is_old_publication === "yes"? `https://asfirj.org/useruploads/manuscripts/${article.manuscript_file}` : `${req.protocol}://${req.get('host')}/useruploads/manuscripts/${article.manuscript_file}`,
                coverLetter: article.cover_letter,
                figures: article.figures,
                tables: article.manuscript_tables,
                supplementaryMaterials: article.supplimentary_materials,
                graphicAbstract: article.graphic_abstract,
                manuscriptPhoto: article.is_old_publication === "yes"? `https://asfirj.org/useruploads/article_images/${article.manuscriptPhoto}` : `${req.protocol}://${req.get('host')}/useruploads/article_images/${article.manuscriptPhoto}`,
                
                // Publication info
                issueNumber: article.issues_number,
                pageNumber: article.page_number,
                doi: article.doi_number,
                isOpenAccess: article.is_open_access === 1,
                isEditorsChoice: article.is_editors_choice === 1,
                hyperlinkToOthers: article.hyperlink_to_others,
                
                // Dates
                dateSubmitted: formatDate(article.date_submitted),
                dateUploaded: formatDate(article.date_uploaded),
                dateReviewed: formatDate(article.date_reviewed),
                dateAccepted: formatDate(article.date_accepted),
                datePublished: formatDate(article.date_published),
                publishedDate: formatDate(article.date_published),
                
                // Statistics
                views: article.views_count || 0,
                downloads: article.downloads_count || 0,
            }
        };
            const clientIp = getClientIp(req);
        
        // Log the IP for debugging
        LogAction(`Request from IP: ${clientIp}`);
        
        // Optional: Log full request details
        LogAction('Request Headers:', req.headers);
        LogAction('Request Socket:', {
            remoteAddress: req.socket?.remoteAddress,
            remotePort: req.socket?.remotePort,
            localAddress: req.socket?.localAddress
        });

        // Check if the client has already viewed this 
        const [hasViewed] = await db.query("SELECT * FROM view_download_count WHERE  user_ip = ? AND article_id = ? AND type = 'viewed'", [clientIp, article.buffer])
        if(!hasViewed || hasViewed.length === 0){
        // Create New View entry 
        await db.query("UPDATE journals SET `views_count` = views_count + 1  WHERE buffer = ?", [article.buffer])
        await db.query("INSERT INTO view_download_count SET ?", [{user_ip:clientIp, article_id:article.buffer, type:"viewed"}])
        LogAction("Created new view entry")
        }else{
        LogAction("Already Viewed this item")
        }

        // Return successful response
        return res.status(200).json(responseData);

    } catch (error) {
        console.error("Error fetching article data:", error);
        
        // Handle specific database errors
        if (error.code === 'ER_CON_COUNT_ERROR') {
            return res.status(500).json({ 
                success: false, 
                error: "Database connection error. Please try again later." 
            });
        }
        
        if (error.code === 'ER_PARSE_ERROR') {
            return res.status(500).json({ 
                success: false, 
                error: "Database query error. Please contact support." 
            });
        }
        
        // Generic error response
        return res.status(500).json({ 
            success: false, 
            error: error.message || "An unexpected error occurred while fetching article data" 
        });
    }
});

// update download count 
router.get("/update-download-count", async(req,res) =>{

try{
const buffer = req.query.buffer 

            const clientIp = getClientIp(req);


 // Check if the client has already viewed this 
        const [hasDownloaded] = await db.query("SELECT * FROM view_download_count WHERE  user_ip = ? AND article_id = ? AND type = 'downloaded'", [clientIp, buffer])
        if(!hasDownloaded || hasDownloaded.length === 0){
        // Create New View entry 
        await db.query("UPDATE journals SET `downloads_count` = downloads_count + 1  WHERE buffer = ?", [buffer])
        await db.query("INSERT INTO view_download_count SET ?", [{user_ip:clientIp, article_id:buffer, type:"downloaded"}])
        LogAction("Created new download entry")
        return res.json({success:"Download updated"})

        }else{
        LogAction("Already downloaded this item")
        return res.json({success:"Download Completed"})
        }

}catch(error){
LogAction(error)
    return res.status(500).json({ 
            success: false, 
            error: error.message || "An unexpected error occurred while downloading data" 
        });
}
})

module.exports = router