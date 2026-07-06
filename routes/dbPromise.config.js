const mysql = require('mysql2/promise');
const dotenv = require("dotenv").config();

const dbPromise = mysql.createPool({
    host: process.env.D_HOST,
    user: process.env.D_USER,
    password: process.env.D_PASSWORD,
    database: process.env.D_NAME,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    acquireTimeout: 10000,
    lockWaitTimeout: 5,
});

module.exports = dbPromise;
