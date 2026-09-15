const mysql = require("mysql2");
const dotenv = require("dotenv").config();

const dbConfig = {
    host: process.env.D_HOST,
    user: process.env.D_USER,
    password: process.env.D_PASSWORD,
    database: process.env.D_NAME
};

let connection = null;

function createConnection() {
    const conn = mysql.createConnection(dbConfig);
    // mysql2 Connection instances emit 'error' events for fatal errors
    // (e.g. code 'PROTOCOL_CONNECTION_LOST'). When nothing listens for that
    // event Node crashes with "Emitted 'error' event on Connection instance",
    // killing the whole API process. Attach a handler so the failure is
    // contained; the proxy's getConnection() lazily creates a fresh connection
    // on the next use so subsequent requests recover automatically.
    conn.on("error", () => {
        // handled: reconnection happens lazily through getConnection()
    });
    return conn;
}

function getConnection() {
    if (
        !connection ||
        connection.destroyed ||
        connection._closing ||
        connection._fatalError ||
        connection._protocolError
    ) {
        if (connection && typeof connection.destroy === "function") {
            try {
                connection.destroy();
            } catch (_) {
                /* already dead */
            }
        }
        connection = createConnection();
    }
    return connection;
}

// Proxy the live connection so every call site that does
//   db.promise().query(...) / db.query(...) / db.execute(...)
// always talks to the current connection and survives connection drops.
const db = new Proxy({}, {
    get(target, prop) {
        const conn = getConnection();
        if (prop === "promise") {
            return () => conn.promise();
        }
        const value = conn[prop];
        if (typeof value === "function") return value.bind(conn);
        return value;
    },
    set(target, prop, value) {
        getConnection()[prop] = value;
        return true;
    }
});

module.exports = db;