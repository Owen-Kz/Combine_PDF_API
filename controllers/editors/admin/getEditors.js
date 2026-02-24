const dbPromise = require("../../../routes/journal.db");
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const NodeCache = require('node-cache');  // npm install node-cache

// Initialize cache with standard TTL (5 minutes)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Configure multer for file uploads (optimized)
const uploadDir = path.join(__dirname, '../../../useruploads/editors');
// Ensure directory exists at startup (not per request)
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'editor-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
                        allowedTypes.test(file.mimetype);
        isValid ? cb(null, true) : cb(new Error('Only image files are allowed'));
    }
}).single('photo');

// ---------- Helper: Fetch fields with counts ----------
async function getFieldsWithCounts() {
    const cacheKey = 'fields:withCounts';
    let fields = cache.get(cacheKey);
    if (fields) return fields;

    const query = `
        SELECT field, COUNT(*) as editorCount
        FROM editors_list
        GROUP BY field
        ORDER BY 
            CASE 
                WHEN field = 'Editor in Chief' THEN 1
                WHEN field = 'Editors' THEN 2
                WHEN field = 'Associate Editors' THEN 3
                ELSE 4
            END,
            MIN(id) ASC
    `;
    const [rows] = await dbPromise.query(query);
    fields = rows.map(f => ({ field: f.field, editorCount: f.editorCount }));
    cache.set(cacheKey, fields);
    return fields;
}

// ---------- Helper: Fetch first N editors for each field ----------
async function getFirstEditorsForFields(fields, limit = 6) {
    const result = {};
    for (const field of fields) {
        const cacheKey = `field:${field.field}:first${limit}`;
        let editors = cache.get(cacheKey);
        if (!editors) {
            const query = `
                SELECT id, prefix, fullname, discipline, photo, bio, field, country
                FROM editors_list
                WHERE field = ?
                ORDER BY id ASC
                LIMIT ?
            `;
            const [rows] = await dbPromise.query(query, [field.field, limit]);
            editors = rows;
            cache.set(cacheKey, editors);
        }
        result[field.field] = editors;
    }
    return result;
}

// ---------- GET Editors Page (rendered with first editors) ----------
const getEditorsPage = async (req, res) => {
    try {
        const fields = await getFieldsWithCounts();
        const firstEditors = await getFirstEditorsForFields(fields, 6);
        
        // console.log('Fields with counts:', fields);
        // console.log('First editors:', firstEditors);

        res.render("editors", {
            fields,
            firstEditors: JSON.stringify(firstEditors), // pass as JSON string for client
            user: req.user || null,
            currentPath: req.path,
            currentYear: new Date().getFullYear()
        });
    } catch (error) {
        console.error("Error loading editors page:", error);
        res.status(500).render("success", {
            status: "error",
            tag: "Error",
            message: "Error loading editors page",
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

// ---------- API: Get editors by single field (with pagination) ----------
const getEditorsByField = async (req, res) => {
    try {
        const { field } = req.query;
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 6;

        if (!field) {
            return res.status(400).json({ status: "error", message: "Field parameter is required" });
        }

        const cacheKey = `field:${field}:offset${offset}:limit${limit}`;
        let cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const query = "SELECT id, prefix, fullname, discipline, photo, bio, field, country FROM editors_list WHERE field = ? ORDER BY id ASC LIMIT ? OFFSET ?";
        const [editors] = await dbPromise.query(query, [field, limit, offset]);

        const countQuery = "SELECT COUNT(*) as total FROM editors_list WHERE field = ?";
        const [[{ total }]] = await dbPromise.query(countQuery, [field]);

        const response = {
            status: "success",
            editors,
            offset: offset + editors.length,
            total,
            hasMore: (offset + editors.length) < total
        };
        cache.set(cacheKey, response);
        res.json(response);
    } catch (error) {
        console.error("Error fetching editors by field:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// ---------- API: Get editors for multiple fields (batch) ----------
const getEditorsByFields = async (req, res) => {
    try {
        const { fields } = req.query; // comma-separated list
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 6;

        if (!fields) {
            return res.status(400).json({ status: "error", message: "Fields parameter is required" });
        }

        const fieldArray = fields.split(',').map(f => f.trim());
        const results = {};

        for (const field of fieldArray) {
            const cacheKey = `field:${field}:offset${offset}:limit${limit}`;
            let data = cache.get(cacheKey);
            if (!data) {
                const query = "SELECT id, prefix, fullname, discipline, photo, bio, field, country FROM editors_list WHERE field = ? ORDER BY id ASC LIMIT ? OFFSET ?";
                const [editors] = await dbPromise.query(query, [field, limit, offset]);
                const countQuery = "SELECT COUNT(*) as total FROM editors_list WHERE field = ?";
                const [[{ total }]] = await dbPromise.query(countQuery, [field]);
                data = {
                    editors,
                    offset: offset + editors.length,
                    total,
                    hasMore: (offset + editors.length) < total
                };
                cache.set(cacheKey, data);
            }
            results[field] = data;
        }

        res.json({ status: "success", results });
    } catch (error) {
        console.error("Error fetching editors by fields:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// ---------- API: Get single editor by ID ----------
const getEditorById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ status: "error", message: "Editor ID is required" });

        const cacheKey = `editor:${id}`;
        let editor = cache.get(cacheKey);
        if (editor) return res.json({ status: "success", editor });

        const [rows] = await dbPromise.query("SELECT id, prefix, fullname, discipline, photo, bio, field, country FROM editors_list WHERE id = ?", [id]);
        if (rows.length === 0) return res.status(404).json({ status: "error", message: "Editor not found" });

        editor = rows[0];
        cache.set(cacheKey, editor);
        res.json({ status: "success", editor });
    } catch (error) {
        console.error("Error fetching editor by ID:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// ---------- POST: Add editor ----------
const addEditor = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ status: "error", message: err.message });

        try {
            const { prefix, fullname, field, discipline, country, bio } = req.body;
            if (!prefix || !fullname || !field || !discipline) {
                return res.status(400).json({ status: "error", message: "Required fields are missing" });
            }

            const photo = req.file ? req.file.filename : null;

            const [result] = await dbPromise.query(
                `INSERT INTO editors_list (prefix, fullname, field, discipline, country, photo, bio)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [prefix, fullname, field, discipline, country, photo, bio]
            );

            // Invalidate related caches
            cache.del(['fields:withCounts', ...cache.keys().filter(k => k.startsWith('field:'))]);

            res.json({ status: "success", message: "Editor added successfully", editorId: result.insertId });
        } catch (error) {
            console.error("Error adding editor:", error);
            res.status(500).json({ status: "error", message: error.message });
        }
    });
};

// ---------- POST: Update editor ----------
const updateEditor = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ status: "error", message: err.message });

        try {
            const { id, prefix, fullname, field, discipline, country, bio } = req.body;
            if (!id) return res.status(400).json({ status: "error", message: "Editor ID is required" });

            const [existing] = await dbPromise.query("SELECT photo FROM editors_list WHERE id = ?", [id]);
            if (existing.length === 0) return res.status(404).json({ status: "error", message: "Editor not found" });

            let photo = existing[0].photo;
            if (req.file) {
                photo = req.file.filename;
                if (existing[0].photo) {
                    try {
                        await fs.unlink(path.join(uploadDir, existing[0].photo));
                    } catch (e) { /* ignore */ }
                }
            }

            await dbPromise.query(
                `UPDATE editors_list SET prefix=?, fullname=?, field=?, discipline=?, country=?, photo=?, bio=?
                 WHERE id=?`,
                [prefix, fullname, field, discipline, country, photo, bio, id]
            );

            // Invalidate caches
            cache.del([`editor:${id}`, 'fields:withCounts', ...cache.keys().filter(k => k.startsWith('field:'))]);

            res.json({ status: "success", message: "Editor updated successfully" });
        } catch (error) {
            console.error("Error updating editor:", error);
            res.status(500).json({ status: "error", message: error.message });
        }
    });
};

// ---------- DELETE: Editor ----------
const deleteEditor = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ status: "error", message: "Editor ID is required" });

        const [editor] = await dbPromise.query("SELECT photo FROM editors_list WHERE id = ?", [id]);
        if (editor.length === 0) return res.status(404).json({ status: "error", message: "Editor not found" });

        await dbPromise.query("DELETE FROM editors_list WHERE id = ?", [id]);

        if (editor[0].photo) {
            try {
                await fs.unlink(path.join(uploadDir, editor[0].photo));
            } catch (e) { /* ignore */ }
        }

        // Invalidate caches
        cache.del([`editor:${id}`, 'fields:withCounts', ...cache.keys().filter(k => k.startsWith('field:'))]);

        res.json({ status: "success", message: "Editor deleted successfully" });
    } catch (error) {
        console.error("Error deleting editor:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// ---------- Utilities ----------
const getDisciplinesByField = async (req, res) => {
    try {
        const { field } = req.query;
        if (!field) return res.status(400).json({ status: "error", message: "Field parameter is required" });

        const cacheKey = `disciplines:${field}`;
        let disciplines = cache.get(cacheKey);
        if (disciplines) return res.json({ status: "success", disciplines });

        const [rows] = await dbPromise.query(
            "SELECT DISTINCT discipline FROM editors_list WHERE field = ? ORDER BY id ASC",
            [field]
        );
        disciplines = rows;
        cache.set(cacheKey, disciplines);
        res.json({ status: "success", disciplines });
    } catch (error) {
        console.error("Error fetching disciplines:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

const getAllFields = async (req, res) => {
    try {
        const fields = await getFieldsWithCounts();
        res.json({ status: "success", fields: fields.map(f => ({ field: f.field })) });
    } catch (error) {
        console.error("Error fetching fields:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

module.exports = {
    getEditorsPage,
    getEditorsByField,
    getEditorsByFields,
    getEditorById,
    addEditor,
    updateEditor,
    deleteEditor,
    getDisciplinesByField,
    getAllFields
};