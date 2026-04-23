const sql = require("mysql2");
const dotenv = require("dotenv").config();
// const { Pool } = require('pg');

const db = sql.createConnection({
    host: process.env.D_HOST,
    user: process.env.D_USER,
    password: process.env.D_PASSWORD,
    database: process.env.D_NAME
})
 
module.exports = db;