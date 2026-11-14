// routes/db.config.js
//
// Shared MySQL access layer.
//
// This module used to keep ONE module-level mysql2 Connection and proxy every
// call onto it. That connection was opened once at boot and never replaced when
// MySQL closed it (wait_timeout, network reset, failover, restart). Handlers
// that captured it a single time, e.g.
//
//     const dbQuery = promisify(db.query).bind(db);
//
// kept writing to the dead socket for the lifetime of the process, producing:
//
//     Error: Can't add new command when connection is in closed state
//
// A pool fixes the root cause: every query borrows a healthy connection, and
// mysql2 drops a connection from the pool as soon as it emits 'error' or 'end'
// (see mysql2/lib/base/pool_connection.js). Keep-alive pings stop the server
// from closing idle pooled connections in the first place.
//
// The public API is unchanged:
//   db.query(sql, params, cb)        callback style, pooled
//   db.execute(sql, params, cb)      callback style, pooled
//   db.promise()                     session object (see DbSession)
//   db.promise().query(sql, params)  promise style, pooled
//   const conn = await db.promise()  session for a transaction
//   await conn.beginTransaction() / commit() / rollback() / release()
//   db.pool                          the underlying mysql2 pool
//
// DbSession deliberately has no `then` method: `await db.promise()` simply
// returns the session object, exactly like the previous implementation, while
// `db.promise().query(...)` still returns a real promise.

const mysql = require("mysql2");
require("dotenv").config();

const connectionLimit = Number(process.env.DB_POOL_SIZE) || 20;

const dbConfig = {
    host: process.env.D_HOST,
    user: process.env.D_USER,
    password: process.env.D_PASSWORD,
    database: process.env.D_NAME,

    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    connectTimeout: 15000,

    // Ping idle connections so the server's wait_timeout never reaps a
    // connection that the pool still believes is usable.
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
};

const pool = mysql.createPool(dbConfig);

// Pool-level errors are logged, never thrown: an unhandled 'error' event on a
// pool would take the whole API process down.
pool.on("error", (error) => {
    console.error("Unexpected database pool error:", error?.message || error);
});

const CLOSED_STATE_PATTERN = /connection is in closed state|Connection is closed/i;

function isClosedStateError(error) {
    return !!error && typeof error.message === "string" && CLOSED_STATE_PATTERN.test(error.message);
}

// A pooled connection can still be closed in the instant between being handed
// out and receiving the command. mysql2 raises that "closed state" error
// before anything reaches MySQL, so one retry on a freshly borrowed connection
// is safe (no statement can be applied twice).
function withRetry(run) {
    return Promise.resolve()
        .then(run)
        .catch((error) => (isClosedStateError(error) ? Promise.resolve().then(run) : Promise.reject(error)));
}

class DbSession {
    constructor(dbPool) {
        this._pool = dbPool;
        this._pendingConnection = null;
        this._inTransaction = false;
    }

    _getConnection() {
        if (!this._pendingConnection) {
            this._pendingConnection = this._pool
                .promise()
                .getConnection()
                .catch((error) => {
                    this._pendingConnection = null;
                    throw error;
                });
        }
        return this._pendingConnection;
    }

    query(sql, params) {
        if (this._inTransaction) {
            return this._getConnection().then((conn) => conn.query(sql, params));
        }
        return withRetry(() => this._pool.promise().query(sql, params));
    }

    execute(sql, params) {
        if (this._inTransaction) {
            return this._getConnection().then((conn) => conn.execute(sql, params));
        }
        return withRetry(() => this._pool.promise().execute(sql, params));
    }

    async beginTransaction() {
        const conn = await this._getConnection();
        try {
            await conn.beginTransaction();
            this._inTransaction = true;
        } catch (error) {
            this.release();
            throw error;
        }
    }

    async commit() {
        if (!this._inTransaction) return;
        try {
            const conn = await this._getConnection();
            await conn.commit();
        } finally {
            this.release();
        }
    }

    async rollback() {
        if (!this._inTransaction) return;
        try {
            const conn = await this._getConnection();
            await conn.rollback();
        } finally {
            this.release();
        }
    }

    // Return the borrowed connection to the pool. Safe to call repeatedly and
    // safe to call on a session that never started a transaction.
    release() {
        const pending = this._pendingConnection;
        this._pendingConnection = null;
        this._inTransaction = false;
        if (!pending) return;
        Promise.resolve(pending)
            .then((conn) => {
                try {
                    conn.release();
                } catch (_) {
                    /* connection already gone */
                }
            })
            .catch(() => {
                /* never acquired */
            });
    }

    // Historical call sites end per-request connections with connection.end().
    // For a pooled session that means "give it back", not "close the pool".
    async end() {
        this.release();
    }

    async destroy() {
        const pending = this._pendingConnection;
        this._pendingConnection = null;
        this._inTransaction = false;
        if (!pending) return;
        try {
            const conn = await pending;
            conn.destroy();
        } catch (_) {
            /* never acquired */
        }
    }
}

const db = new Proxy(
    {},
    {
        get(_target, prop) {
            if (prop === "promise") return () => new DbSession(pool);
            if (prop === "pool") return pool;
            // Without this, `await db` on the proxy would never settle.
            if (prop === "then") return undefined;
            const value = pool[prop];
            return typeof value === "function" ? value.bind(pool) : value;
        },
        set(_target, prop, value) {
            pool[prop] = value;
            return true;
        },
    }
);

module.exports = db;
