// routes/dbPromise.config.js
//
// Promise-style database handle used across the API. It is backed by the same
// pool as routes/db.config.js so the process keeps one bounded set of
// connections (instead of one pool per module) with the same keep-alive and
// self-healing behaviour.
//
// Supported, unchanged API:
//   dbPromise.query(sql, params)      -> [rows, fields]
//   dbPromise.execute(sql, params)    -> [rows, fields]
//   dbPromise.getConnection()         -> pooled connection (beginTransaction,
//                                        commit, rollback, release)

const db = require("./db.config");

module.exports = db.pool.promise();
