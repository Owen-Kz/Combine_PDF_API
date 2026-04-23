const mysql = require('mysql2/promise');
const dotenv = require("dotenv").config();

const dbPromise = mysql.createPool({
    host: process.env.D_HOST,
    user: process.env.D_USER,
    password: process.env.D_PASSWORD,
    database: process.env.D_NAME
})

module.exports = dbPromise;