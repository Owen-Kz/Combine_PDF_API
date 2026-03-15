// backend/routes/editors/issues.js
const express = require("express");
const { config } = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const dbPromise = require("./journal.db");
const isAdminAccount = require("../controllers/editors/isAdminAccount");
const SendPublicationEmail = require("../controllers/utils/sendPublicationEmail");
const AuthorLoggedIn = require("../controllers/account/AuthorLoggedIn");

config();
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = path.join(__dirname, "../useruploads/");
        
        // Determine subfolder based on file type
        if (file.fieldname === 'manuscriptCover') {
            uploadPath = path.join(uploadPath, "article_images/");
        } else if (file.fieldname === 'manuscript_file') {
            uploadPath = path.join(uploadPath, "manuscripts/");
        } else {
            uploadPath = path.join(uploadPath, "misc/");
        }
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Create unique filename with timestamp
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '_' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: function (req, file, cb) {
        // Accept images and documents
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image and document files are allowed'));
        }
    }
});

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

// Enable CORS for this router
router.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// Helper function to generate file URL based on is_old_publication
const getFileUrl = (filename, type, isOldPublication) => {
    if (!filename) return null;
    
    if (isOldPublication === 'yes') {
        // Old publications use the full asfirj.org URL
        if (type === 'image') {
            return `https://asfirj.org/useruploads/article_images/${filename}`;
        } else if (type === 'manuscript') {
            return `https://asfirj.org/useruploads/manuscripts/${filename}`;
        }
    } else {
        // New publications use relative path
        if (type === 'image') {
            return `${process.env.CURRENT_DOMAIN}/useruploads/article_images/${filename}`;
        } else if (type === 'manuscript') {
            return `${process.env.CURRENT_DOMAIN}/useruploads/manuscripts/${filename}`;
        }
    }
    
    return null;
};

// Helper function to get default cover image
const getDefaultCoverImage = (isOldPublication) => {
    if (isOldPublication === 'yes') {
        return 'https://asfirj.org/assets/images/asfischolar.jpg';
    }
    return '/assets/images/asfischolar.jpg';
};

// ============================================
// GET ALL ISSUES (with pagination and search)
// ============================================
router.get("/issues/all", AuthorLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Check if user is admin
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ error: "Not authorized" });
        }

        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.limit) || 6;
        const offset = (page - 1) * itemsPerPage;
        const searchQuery = req.query.search || '';

        let baseQuery = `
            SELECT 
                j.*,
                GROUP_CONCAT(
                    JSON_OBJECT(
                        'id', a.id,
                        'prefix', a.authors_prefix,
                        'firstname', a.authors_firstname,
                        'middlename', a.authors_middlename,
                        'lastname', a.authors_lastname,
                        'email', a.authors_email,
                        'institution', a.authors_institution,
                        'country', a.institution_country,
                        'city', a.institution_city,
                        'fullname', a.authors_fullname
                    )
                ) as authors_json
            FROM journals j
            LEFT JOIN authors a ON j.buffer = a.article_id
                AND a.authors_fullname IS NOT NULL 
                AND a.authors_fullname != ''
            WHERE j.is_publication = 'yes'
        `;

        let countQuery = `
            SELECT COUNT(DISTINCT j.id) as total
            FROM journals j
            WHERE j.is_publication = 'yes'
        `;

        let queryParams = [];
        let countParams = [];

        // Add search conditions
        if (searchQuery && searchQuery.length >= 2) {
            const searchCondition = ` AND (
                j.manuscript_full_title LIKE ? OR 
                j.manuscript_running_title LIKE ? OR
                j.issues_number LIKE ? OR
                j.doi_number LIKE ?
            )`;
            
            baseQuery += searchCondition;
            countQuery += searchCondition;
            
            const searchPattern = `%${searchQuery}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Group by and order
        baseQuery += ` GROUP BY j.id ORDER BY j.id DESC LIMIT ? OFFSET ?`;
        queryParams.push(itemsPerPage, offset);

        // Execute queries
        const [issues] = await dbPromise.query(baseQuery, queryParams);
        const [countResult] = await dbPromise.query(countQuery, countParams);

        // Parse authors JSON for each issue
        const formattedIssues = issues.map(issue => {
            let authors = [];
            try {
                if (issue.authors_json) {
                    authors = JSON.parse(`[${issue.authors_json}]`);
                }
            } catch (e) {
                console.error("Error parsing authors JSON:", e);
            }

            // Format dates
            const formatDate = (dateStr) => {
                if (!dateStr) return null;
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            };

            // Determine if this is an old publication
            const isOldPublication = issue.is_old_publication || 'no';

            return {
                id: issue.buffer || issue.id,
                title: issue.manuscript_full_title,
                type: issue.article_type,
                volume: issue.issues_number ? `Vol ${issue.issues_number}` : null,
                issue: issue.issues_number,
                date: issue.date_published ? formatDate(issue.date_published) : null,
                articles: authors.length,
                coverImage: issue.manuscriptPhoto 
                    ? getFileUrl(issue.manuscriptPhoto, 'image', isOldPublication)
                    : getDefaultCoverImage(isOldPublication),
                pdfUrl: issue.manuscript_file 
                    ? getFileUrl(issue.manuscript_file, 'manuscript', isOldPublication)
                    : null,
                description: issue.unstructured_abstract,
                manuscript_contents: issue.abstract_discussion,
                editor: null, // This would need to be fetched from editors table
                publishedDate: issue.date_published ? formatDate(issue.date_published) : null,
                doi: issue.doi_number,
                issue_number: issue.issues_number,
                page_number: issue.page_number,
                date_submitted: issue.date_submitted,
                date_reviewed: issue.date_reviewed,
                date_accepted: issue.date_accepted,
                date_published: issue.date_published,
                open_access: issue.is_open_access === 'yes',
                editor_choice: issue.is_editors_choice === 'yes',
                Hyperlink: issue.hyperlink_to_others,
                authors: authors,
                views_count: issue.views_count || 0,
                downloads_count: issue.downloads_count || 0,
                is_old_publication: isOldPublication
            };
        });

        return res.json({
            status: "success",
            articlesList: formattedIssues,
            totalPages: Math.ceil((countResult[0]?.total || 0) / itemsPerPage),
            currentPage: page
        });

    } catch (error) {
        console.error("Error fetching issues:", error);
        return res.status(500).json({ 
            status: "internalError", 
            message: error.message 
        });
    }
});

// ============================================
// GET ALL SUPPLEMENTS (with pagination and search)
// ============================================
router.get("/supplements/all", AuthorLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Check if user is admin
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ error: "Not authorized" });
        }

        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.limit) || 6;
        const offset = (page - 1) * itemsPerPage;
        const searchQuery = req.query.search || '';

        let baseQuery = `
            SELECT 
                j.*,
                GROUP_CONCAT(
                    JSON_OBJECT(
                        'id', a.id,
                        'prefix', a.authors_prefix,
                        'firstname', a.authors_firstname,
                        'middlename', a.authors_middlename,
                        'lastname', a.authors_lastname,
                        'email', a.authors_email,
                        'institution', a.authors_institution,
                        'country', a.institution_country,
                        'city', a.institution_city,
                        'fullname', a.authors_fullname
                    )
                ) AS authors_json
            FROM journals j
            LEFT JOIN authors a 
                ON j.buffer = a.article_id 
                AND a.authors_fullname IS NOT NULL 
                AND a.authors_fullname != ''
            WHERE j.is_publication = 'no' OR j.is_publication IS NULL
        `;

        let countQuery = `
            SELECT COUNT(DISTINCT j.id) as total
            FROM journals j
            WHERE j.is_publication = 'no' OR j.is_publication IS NULL
        `;

        let queryParams = [];
        let countParams = [];

        // Add search conditions
        if (searchQuery && searchQuery.length >= 2) {
            const searchCondition = ` AND (
                j.manuscript_full_title LIKE ? OR 
                j.manuscript_running_title LIKE ? OR
                fullname LIKE ? OR
                corresponding_authors_email LIKE ?
            )`;
            
            baseQuery += searchCondition;
            countQuery += searchCondition;
            
            const searchPattern = `%${searchQuery}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Group by and order
        baseQuery += ` GROUP BY j.id ORDER BY j.id DESC LIMIT ? OFFSET ?`;
        queryParams.push(itemsPerPage, offset);

        // Execute queries
        const [supplements] = await dbPromise.query(baseQuery, queryParams);
        const [countResult] = await dbPromise.query(countQuery, countParams);

        // Parse authors JSON for each supplement
        const formattedSupplements = supplements.map(supplement => {
            let authors = [];
            try {
                if (supplement.authors_json) {
                    authors = JSON.parse(`[${supplement.authors_json}]`);
                }
            } catch (e) {
                console.error("Error parsing authors JSON:", e);
            }

            // Format date
            const formatDate = (dateStr) => {
                if (!dateStr) return null;
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
            };

            // Get corresponding author
            const correspondingAuthor = authors.find(a => a.email === supplement.corresponding_authors_email) || authors[0];

            // Determine if this is an old publication
            const isOldPublication = supplement.is_old_publication || 'no';

            return {
                id: supplement.buffer,
                article_id: supplement.buffer,
                title: supplement.manuscript_full_title,
                type: supplement.article_type,
                authors: authors.map(a => a.fullname || `${a.prefix || ''} ${a.firstname || ''} ${a.lastname || ''}`.trim()),
                firstPublished: supplement.date_published ? formatDate(supplement.date_published) : formatDate(supplement.date_uploaded),
                views: supplement.views_count || 0,
                downloads: supplement.downloads_count || 0,
                category: 'supplement',
                coverImage: supplement.manuscriptPhoto 
                    ? getFileUrl(supplement.manuscriptPhoto, 'image', isOldPublication)
                    : getDefaultCoverImage(isOldPublication),
                pdfUrl: supplement.manuscript_file 
                    ? getFileUrl(supplement.manuscript_file, 'manuscript', isOldPublication)
                    : null,
                abstract: supplement.unstructured_abstract || null,
                openAccess: supplement.is_open_access === 'yes',
                // keywords: [], // Would need separate table for keywords
                doi: supplement.doi_number,
                correspondingAuthor: correspondingAuthor?.fullname || '',
                correspondingEmail: supplement.corresponding_authors_email || correspondingAuthor?.email || '',
                corresponding_author: supplement.corresponding_authors_email || correspondingAuthor?.email || '',
                issue_number: supplement.issues_number,
                page_number: supplement.page_number,
                date_submitted: supplement.date_submitted,
                date_reviewed: supplement.date_reviewed,
                date_accepted: supplement.date_accepted,
                date_published: supplement.date_published,
                editor_choice: supplement.is_editors_choice === 'yes',
                open_access: supplement.is_open_access === 'yes',
                Hyperlink: supplement.hyperlink_to_others,
                manuscript_contents: supplement.abstract_discussion,
                authorsArray: authors,
                is_old_publication: isOldPublication
            };
        });

        return res.json({
            status: "success",
            articlesList: formattedSupplements,
            totalPages: Math.ceil((countResult[0]?.total || 0) / itemsPerPage),
            currentPage: page
        });

    } catch (error) {
        console.error("Error fetching supplements:", error);
        return res.status(500).json({ 
            status: "internalError", 
            message: error.message 
        });
    }
});

// ============================================
// GET SINGLE ISSUE/SUPPLEMENT BY ID
// ============================================
router.get("/item/:id", AuthorLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        const itemId = req.params.id;
        
        // Check if user is admin
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ error: "Not authorized" });
        }

        const [items] = await dbPromise.query(`
            SELECT 
                j.*,
                GROUP_CONCAT(
                    JSON_OBJECT(
                        'id', a.id,
                        'prefix', a.authors_prefix,
                        'firstname', a.authors_firstname,
                        'middlename', a.authors_middlename,
                        'lastname', a.authors_lastname,
                        'email', a.authors_email,
                        'institution', a.authors_institution,
                        'country', a.institution_country,
                        'city', a.institution_city,
                        'fullname', a.authors_fullname
                    )
                ) as authors_json
            FROM journals j
            LEFT JOIN authors a ON j.buffer = a.article_id
            WHERE j.buffer = ?
            GROUP BY j.id
        `, [itemId]);

        if (items.length === 0) {
            return res.status(404).json({ error: "Item not found" });
        }

        const item = items[0];
        let authors = [];
        try {
            if (item.authors_json) {
                authors = JSON.parse(`[${item.authors_json}]`);
            }
        } catch (e) {
            console.error("Error parsing authors JSON:", e);
        }

        // Determine if this is an old publication
        const isOldPublication = item.is_old_publication || 'no';

        // Format response similar to the frontend structure
        const formattedItem = {
            id: item.buffer,
            title: item.manuscript_full_title,
            type: item.article_type,
            authors: authors.map(a => a.fullname || `${a.prefix || ''} ${a.firstname || ''} ${a.lastname || ''}`.trim()),
            firstPublished: item.date_published,
            views: item.views_count || 0,
            downloads: item.downloads_count || 0,
            coverImage: item.manuscriptPhoto 
                ? getFileUrl(item.manuscriptPhoto, 'image', isOldPublication)
                : getDefaultCoverImage(isOldPublication),
            pdfUrl: item.manuscript_file 
                ? getFileUrl(item.manuscript_file, 'manuscript', isOldPublication)
                : null,
            abstract: item.unstructured_abstract || item.abstract_discussion,
            openAccess: item.is_open_access === 'yes',
            // keywords: [],
            doi: item.doi_number,
            correspondingAuthor: authors.find(a => a.email === item.corresponding_authors_email)?.fullname || '',
            correspondingEmail: item.corresponding_authors_email,
            issue_number: item.issues_number,
            page_number: item.page_number,
            date_submitted: item.date_submitted,
            date_reviewed: item.date_reviewed,
            date_accepted: item.date_accepted,
            date_published: item.date_published,
            editor_choice: item.is_editors_choice === 'yes',
            open_access: item.is_open_access === 'yes',
            Hyperlink: item.hyperlink_to_others,
            is_publication: item.is_publication === 'yes',
            authorsArray: authors,
            is_old_publication: isOldPublication
        };

        return res.json({
            status: "success",
            item: formattedItem
        });

    } catch (error) {
        console.error("Error fetching item:", error);
        return res.status(500).json({ 
            status: "internalError", 
            message: error.message 
        });
    }
});

// ============================================
// UPDATE ISSUE/SUPPLEMENT
// ============================================
router.post("/update/:id", AuthorLoggedIn, upload.fields([
    { name: 'manuscriptCover', maxCount: 1 },
    { name: 'manuscript_file', maxCount: 1 }
]), async (req, res) => {
    try {
        const userId = req.user.id;
        const itemId = req.params.id;
        
        // Check if user is admin
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ error: "Not authorized" });
        }

        const {
            article_type,
            title,
            authorsArray,
            corresponding_author,
            abstract,
            manuscript_contents,
            Hyperlink,
            issue_number,
            page_number,
            doi_number,
            date_submitted,
            date_reviewed,
            date_accepted,
            date_published,
            editor_choice,
            open_access,
            // keywords,
            remove_cover,
            remove_manuscript
        } = req.body;

        // Get current item data to know existing files
        const [currentItems] = await dbPromise.query(
            "SELECT * FROM journals WHERE buffer = ?",
            [itemId]
        );

        if (currentItems.length === 0) {
            return res.status(404).json({ error: "Item not found" });
        }

        const currentItem = currentItems[0];

        // Begin transaction
        const connection = await dbPromise.getConnection();
        await connection.beginTransaction();

        try {
            // Update journals table
            let updateQuery = `
                UPDATE journals SET
                    article_type = ?,
                    manuscript_full_title = ?,
                    unstructured_abstract = ?,
                    abstract_discussion = ?,
                    corresponding_authors_email = ?,
                    hyperlink_to_others = ?,
                    issues_number = ?,
                    page_number = ?,
                    doi_number = ?,
                    date_submitted = ?,
                    date_reviewed = ?,
                    date_accepted = ?,
                    date_published = ?,
                    is_editors_choice = ?,
                    is_open_access = ?
            `;

            const updateParams = [
                article_type || currentItem.article_type,
                title || currentItem.manuscript_full_title,
                abstract || currentItem.unstructured_abstract,
                manuscript_contents || currentItem.abstract_discussion,
                corresponding_author || currentItem.corresponding_authors_email,
                Hyperlink || currentItem.hyperlink_to_others,
                issue_number || currentItem.issues_number,
                page_number || currentItem.page_number,
                doi_number || currentItem.doi_number,
                date_submitted || currentItem.date_submitted,
                date_reviewed || currentItem.date_reviewed,
                date_accepted || currentItem.date_accepted,
                date_published || currentItem.date_published,
                editor_choice === 'true' ? 'yes' : 'no',
                open_access === 'true' ? 'yes' : 'no'
            ];

            // Handle cover image upload
            if (req.files && req.files['manuscriptCover']) {
                const coverFile = req.files['manuscriptCover'][0];
                updateQuery += `, manuscriptPhoto = ?`;
                updateParams.push(coverFile.filename);

                // Delete old cover image if it exists
                if (currentItem.manuscriptPhoto) {
                    const oldPath = path.join(__dirname, "../useruploads/article_images/", currentItem.manuscriptPhoto);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
            } else if (remove_cover === 'true') {
                updateQuery += `, manuscriptPhoto = NULL`;
                if (currentItem.manuscriptPhoto) {
                    const oldPath = path.join(__dirname, "../useruploads/article_images/", currentItem.manuscriptPhoto);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
            }

            // Handle manuscript file upload
            if (req.files && req.files['manuscript_file']) {
                const manuscriptFile = req.files['manuscript_file'][0];
                updateQuery += `, manuscript_file = ?`;
                updateParams.push(manuscriptFile.filename);

                // Delete old manuscript file if it exists
                if (currentItem.manuscript_file) {
                    const oldPath = path.join(__dirname, "../useruploads/manuscripts/", currentItem.manuscript_file);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
            } else if (remove_manuscript === 'true') {
                updateQuery += `, manuscript_file = NULL`;
                if (currentItem.manuscript_file) {
                    const oldPath = path.join(__dirname, "../useruploads/manuscripts/", currentItem.manuscript_file);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
            }

            updateQuery += ` WHERE buffer = ?`;
            updateParams.push(itemId);

            await connection.query(updateQuery, updateParams);

            // Handle authors update if provided
            if (authorsArray) {
                // Delete existing authors
                await connection.query("DELETE FROM authors WHERE article_id = ?", [itemId]);

                // Insert new authors
                const authors = authorsArray.split(',').map(a => a.trim()).filter(a => a);
                for (const authorFullname of authors) {
                    await connection.query(
                        "INSERT INTO authors (authors_fullname, article_id) VALUES (?, ?)",
                        [authorFullname, itemId]
                    );
                }
            }

            await connection.commit();

            return res.json({
                status: "success",
                message: "Item updated successfully"
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error("Error updating item:", error);
        return res.status(500).json({ 
            status: "internalError", 
            message: error.message 
        });
    }
});

// ============================================
// DELETE ISSUE/SUPPLEMENT
// ============================================
router.delete("/delete/:id", AuthorLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        const itemId = req.params.id;
        
        // Check if user is admin
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Get item to delete associated files
        const [items] = await dbPromise.query(
            "SELECT manuscriptPhoto, manuscript_file FROM journals WHERE buffer = ?",
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).json({ error: "Item not found" });
        }

        const item = items[0];

        // Begin transaction
        const connection = await dbPromise.getConnection();
        await connection.beginTransaction();

        try {
            // Delete associated authors
            await connection.query("DELETE FROM authors WHERE article_id = ?", [itemId]);

            // Delete the journal entry
            await connection.query("DELETE FROM journals WHERE buffer = ?", [itemId]);

            await connection.commit();

            // Delete physical files after successful DB deletion
            if (item.manuscriptPhoto) {
                const imagePath = path.join(__dirname, "../useruploads/article_images/", item.manuscriptPhoto);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }

            if (item.manuscript_file) {
                const filePath = path.join(__dirname, "../useruploads/manuscripts/", item.manuscript_file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            return res.json({
                status: "success",
                message: "Item deleted successfully"
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error("Error deleting item:", error);
        return res.status(500).json({ 
            status: "internalError", 
            message: error.message 
        });
    }
});

// ============================================
// CREATE NEW ISSUE/SUPPLEMENT
// ============================================
router.post("/create", AuthorLoggedIn, upload.fields([
    { name: 'manuscriptCover', maxCount: 1 },
    { name: 'manuscript_file', maxCount: 1 }
]), async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Check if user is admin
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ error: "Not authorized" });
        }

        const {
            article_type,
            title,
            authorsArray,
            corresponding_author,
            abstract,
            manuscript_contents,
            Hyperlink,
            issue_number,
            page_number,
            doi_number,
            date_submitted,
            date_reviewed,
            date_accepted,
            date_published,
            editor_choice,
            open_access,
            is_publication,
            is_old_publication
        } = req.body;

        // Validate required fields
        if (!title) {
            return res.status(400).json({ error: "Title is required" });
        }
        if (!corresponding_author) {
            return res.status(400).json({ error: "Corresponding author email is required" });
        }

        // Generate unique buffer ID
        const buffer = 'ASFIRJNL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Begin transaction
        const connection = await dbPromise.getConnection();
        await connection.beginTransaction();

        try {
            // Insert into journals table
            const insertQuery = `
                INSERT INTO journals (
                    article_type,
                    manuscript_full_title,
                    unstructured_abstract,
                    abstract_discussion,
                    corresponding_authors_email,
                    hyperlink_to_others,
                    issues_number,
                    page_number,
                    doi_number,
                    date_submitted,
                    date_reviewed,
                    date_accepted,
                    date_published,
                    is_editors_choice,
                    is_open_access,
                    is_publication,
                    is_old_publication,
                    manuscriptPhoto,
                    manuscript_file,
                    buffer,
                    date_uploaded,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'published')
            `;

            const insertParams = [
                article_type || 'Original Article',
                title,
                abstract || null,
                manuscript_contents || null,
                corresponding_author || null,
                Hyperlink || null,
                issue_number || null,
                page_number || null,
                doi_number || null,
                date_submitted || null,
                date_reviewed || null,
                date_accepted || null,
                date_published || null,
                editor_choice === 'true' ? 'yes' : 'no',
                open_access === 'true' ? 'yes' : 'no',
                is_publication === 'true' ? 'yes' : 'no',
                is_old_publication === 'true' ? 'yes' : 'no',
                req.files && req.files['manuscriptCover'] ? req.files['manuscriptCover'][0].filename : null,
                req.files && req.files['manuscript_file'] ? req.files['manuscript_file'][0].filename : null,
                buffer
            ];

            const [result] = await connection.query(insertQuery, insertParams);

            // Handle authors if provided
            if (authorsArray) {
                const authors = authorsArray.split(',').map(a => a.trim()).filter(a => a);
                for (const authorFullname of authors) {
                    await connection.query(
                        "INSERT INTO authors (authors_fullname, article_id) VALUES (?, ?)",
                        [authorFullname, buffer]
                    );
                }
            }

            await connection.commit();

            // Send publication email to corresponding author
            // This is done after commit to ensure the record is saved
            if (req.files && req.files['manuscript_file'] && req.files['manuscript_file'][0]) {
                const fileName = req.files['manuscript_file'][0].filename;
                const issueNum = issue_number || '1'; // Default to issue 1 if not provided
                
                // Send email asynchronously - don't wait for it to complete
                // This prevents email sending delays from affecting the response
                SendPublicationEmail(corresponding_author, title, buffer, issueNum, fileName)
                    .then(emailResult => {
                        if (emailResult.status === 'success') {
                            console.log(`Publication email sent to ${corresponding_author} for manuscript ${buffer}`);
                        } else {
                            console.error(`Failed to send publication email to ${corresponding_author}:`, emailResult.message);
                        }
                    })
                    .catch(emailError => {
                        console.error(`Error sending publication email to ${corresponding_author}:`, emailError);
                    });
            } else {
                console.warn(`No manuscript file found for ${buffer}, email not sent to ${corresponding_author}`);
            }

            return res.json({
                status: "success",
                message: "Item created successfully",
                id: buffer
            });

        } catch (error) {
            await connection.rollback();
            console.error("Transaction error:", error);
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error("Error creating item:", error);
        return res.status(500).json({ 
            status: "internalError", 
            message: error.message 
        });
    }
});
// ============================================
// UPDATE VIEWS COUNT
// ============================================
router.post("/views/:id", async (req, res) => {
    try {
        const itemId = req.params.id;
        
        await dbPromise.query(
            "UPDATE journals SET views_count = views_count + 1 WHERE buffer = ?",
            [itemId]
        );

        return res.json({
            status: "success",
            message: "Views count updated"
        });

    } catch (error) {
        console.error("Error updating views:", error);
        return res.status(500).json({ 
            status: "internalError", 
            message: error.message 
        });
    }
});

// ============================================
// UPDATE DOWNLOADS COUNT
// ============================================
router.post("/downloads/:id", async (req, res) => {
    try {
        const itemId = req.params.id;
        
        await dbPromise.query(
            "UPDATE journals SET downloads_count = downloads_count + 1 WHERE buffer = ?",
            [itemId]
        );

        return res.json({
            status: "success",
            message: "Downloads count updated"
        });

    } catch (error) {
        console.error("Error updating downloads:", error);
        return res.status(500).json({ 
            status: "internalError", 
            message: error.message 
        });
    }
});

module.exports = router;