const dbPromise = require("../../../routes/journal.db");
const path = require('path');
const fs = require('fs').promises;
const NodeCache = require('node-cache');  // npm install node-cache
const { transformToLowerCase } = require("../../../utils/utils.global");

// Initialize cache with standard TTL (5 minutes)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Directory where editor photos are stored (uploaded via /api/uploads/editor-image)
const uploadDir = path.join(__dirname, '../../useruploads/editors');

// The upload route (/api/uploads/editor-image) saves files to useruploads/editor-images/,
// but editor photos are stored under useruploads/editors/.
// We normalize whatever URL/filename the client sends us to just the filename
// so the DB continues to store a bare filename (consistent with existing records).
const normalizePhotoValue = (photoValue) => {
    if (!photoValue || typeof photoValue !== 'string') return null;
    const trimmed = photoValue.trim();
    if (!trimmed) return null;

    // If it's a full URL, extract the last path segment (filename)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
        try {
            const withoutQuery = trimmed.split('?')[0].split('#')[0];
            const parts = withoutQuery.split('/').filter(Boolean);
            const filename = parts[parts.length - 1];
            return filename ? decodeURIComponent(filename) : null;
        } catch (_) {
            return null;
        }
    }

    // Bare filename – return as-is
    return trimmed;
};

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
                SELECT id, prefix, fullname, email, discipline, photo, bio, field, country, is_old_editor
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

        const query = "SELECT id, prefix, fullname, email, discipline, photo, bio, field, country, is_old_editor FROM editors_list WHERE field = ? ORDER BY id ASC LIMIT ? OFFSET ?";
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
                const query = "SELECT id, prefix, fullname, email, discipline, photo, bio, field, country, is_old_editor FROM editors_list WHERE field = ? ORDER BY id ASC LIMIT ? OFFSET ?";
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

        const [rows] = await dbPromise.query("SELECT id, prefix, fullname, email, discipline, photo, bio, field, country, is_old_editor FROM editors_list WHERE id = ?", [id]);
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
// Expects `photo` in the body as either a bare filename or a full URL
// (the client already uploaded the image via /api/uploads/editor-image).
const addEditor = async (req, res) => {
    try {
        const { prefix, fullname, email, field, discipline, country, bio, photo } = req.body;

        if (!prefix || !fullname || !field || !discipline) {
            return res.status(400).json({ status: "error", message: "Required fields are missing" });
        }

        const photoFilename = normalizePhotoValue(photo);

        const [result] = await dbPromise.query(
            `INSERT INTO editors_list (prefix, fullname, email, field, discipline, country, photo, bio)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [prefix, fullname, transformToLowerCase(email) || null, field, discipline, country, photoFilename, bio]
        );

        // Invalidate all editor-related caches
        const keysToDelete = cache.keys().filter(k =>
            k.startsWith('field:') || k.startsWith('disciplines:')
        );
        keysToDelete.push('fields:withCounts');
        cache.del(keysToDelete);

        res.json({ status: "success", message: "Editor added successfully", editorId: result.insertId });
    } catch (error) {
        console.error("Error adding editor:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// ---------- POST: Update editor ----------
// Expects `photo` in the body as either a bare filename or a full URL.
// If the photo value differs from the existing one, the old local file is removed.
const updateEditor = async (req, res) => {
    try {
        const { id, prefix, fullname, email, field, discipline, country, bio, photo, is_old_editor } = req.body;
        if (!id) return res.status(400).json({ status: "error", message: "Editor ID is required" });

        const [existing] = await dbPromise.query(
            "SELECT photo, is_old_editor FROM editors_list WHERE id = ?",
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ status: "error", message: "Editor not found" });
        }

        const existingPhoto = existing[0].photo;
        const existingIsOld = existing[0].is_old_editor || 'no';

        // Normalize incoming photo (may be a URL or filename)
        const incomingPhotoFilename = normalizePhotoValue(photo);

        let finalPhoto = existingPhoto;
        let finalIsOld = existingIsOld;

        // Photo changed (or a new photo was provided)
        if (incomingPhotoFilename && incomingPhotoFilename !== existingPhoto) {
            finalPhoto = incomingPhotoFilename;
            // Newly uploaded photos are never "old editors"
            finalIsOld = 'no';

            // Delete the previously stored local file (skip external/legacy URLs)
            if (existingPhoto && existingIsOld !== 'yes') {
                try {
                    await fs.unlink(path.join(uploadDir, existingPhoto));
                } catch (e) {
                    // File may not exist locally; ignore
                }
            }
        } else if (is_old_editor !== undefined) {
            // Client explicitly sent is_old_editor; honour it
            finalIsOld = is_old_editor;
        }

        await dbPromise.query(
            `UPDATE editors_list SET prefix=?, fullname=?, email=?, field=?, discipline=?, country=?, photo=?, bio=?, is_old_editor=?
             WHERE id=?`,
            [prefix, fullname, email || null, field, discipline, country, finalPhoto, bio, finalIsOld, id]
        );

        // Invalidate all editor-related caches
        const keysToDelete = cache.keys().filter(k =>
            k.startsWith('field:') || k.startsWith('editor:') || k.startsWith('disciplines:')
        );
        keysToDelete.push('fields:withCounts');
        cache.del(keysToDelete);

        res.json({ status: "success", message: "Editor updated successfully" });
    } catch (error) {
        console.error("Error updating editor:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

// ---------- DELETE: Editor ----------
const deleteEditor = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ status: "error", message: "Editor ID is required" });

        const [editor] = await dbPromise.query("SELECT photo, is_old_editor FROM editors_list WHERE id = ?", [id]);
        if (editor.length === 0) return res.status(404).json({ status: "error", message: "Editor not found" });

        await dbPromise.query("DELETE FROM editors_list WHERE id = ?", [id]);

        // Only try to delete the local file for non-legacy editors
        if (editor[0].photo && editor[0].is_old_editor !== 'yes') {
            try {
                await fs.unlink(path.join(uploadDir, editor[0].photo));
            } catch (e) {
                // File may not exist locally; ignore
            }
        }

        // Invalidate all editor-related caches
        const keysToDelete = cache.keys().filter(k =>
            k.startsWith('field:') || k.startsWith('editor:') || k.startsWith('disciplines:')
        );
        keysToDelete.push('fields:withCounts');
        cache.del(keysToDelete);

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