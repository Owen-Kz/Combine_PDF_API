const mysql = require("mysql2/promise");

// Create a connection pool with optimal settings
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.JOURNAL_DB_PASSWORD || "",
    database: process.env.JOURNAL_DB_NAME || "wepeugsn_asfi_journal",
    waitForConnections: true,
    connectionLimit: 20,               // Increased for higher concurrency
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: '+00:00'                  // Ensure UTC for consistent date handling
});

// Test the connection on startup
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log(' Database connected successfully');
        conn.release();
    } catch (err) {
        console.error(' Database connection failed:', err.message);
        process.exit(1);
    }
})();

// Note: Run these SQL statements once to add required indexes:
// ALTER TABLE editors_list ADD INDEX idx_field (field);
// ALTER TABLE editors_list ADD INDEX idx_field_id (field, id);

module.exports = pool;