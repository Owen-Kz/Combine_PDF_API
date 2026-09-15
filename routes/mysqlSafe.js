// mysqlSafe.js
//
// mysql2 Connection / Pool instances emit 'error' events for fatal socket and
// protocol failures (e.g. PROTOCOL_CONNECTION_LOST). When no listener is
// attached, Node crashes the whole API process with:
//     "Emitted 'error' event on Connection instance: { fatal: true, code: 'PROTOCOL_CONNECTION_LOST' }"
//
// This module patches mysql2 so EVERY connection and pool created afterwards
// automatically carries a no-op 'error' listener, converting those crashes into
// contained, silent failures. It must be required BEFORE any other module that
// creates a database connection (do this at the very top of app.js).
//
// Patching is idempotent and does not change the API surface used elsewhere.

const mysql = require("mysql2");

if (!mysql.__asfirjErrorGuardInstalled) {
    mysql.__asfirjErrorGuardInstalled = true;

    const originalCreateConnection = mysql.createConnection.bind(mysql);
    mysql.createConnection = function (...args) {
        const conn = originalCreateConnection(...args);
        if (typeof conn.on === "function") {
            conn.on("error", () => {});
        }
        return conn;
    };

    const originalCreatePool = mysql.createPool.bind(mysql);
    mysql.createPool = function (...args) {
        const pool = originalCreatePool(...args);
        if (typeof pool.on === "function") {
            pool.on("error", () => {});
        }
        return pool;
    };
}

// Also cover the promise API used by dbPromise.config.js / db-pool.config.js
const mysqlPromise = require("mysql2/promise");
if (!mysqlPromise.__asfirjErrorGuardInstalled) {
    mysqlPromise.__asfirjErrorGuardInstalled = true;
    const originalCreatePool = mysqlPromise.createPool.bind(mysqlPromise);
    mysqlPromise.createPool = function (...args) {
        const pool = originalCreatePool(...args);
        if (typeof pool.on === "function") {
            pool.on("error", () => {});
        }
        return pool;
    };
}

module.exports = mysql;