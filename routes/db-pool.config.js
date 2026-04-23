const mysql = require('mysql2');
require('dotenv').config();

const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
  port: process.env.D_PORT || 3306,
  
  // Correct connection pool settings
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000, // 60 seconds
  
  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',
  
  // SSL configuration (if required by your hosting provider)
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = mysql.createPool(dbConfig);

const promisePool = pool.promise();

// Test connection function
const testConnection = async () => {
  try {
    const connection = await promisePool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down database connection...');
  await pool.end();
  console.log('✅ Database connection closed');
  process.exit(0);
});

module.exports = {
  pool: promisePool,
  testConnection,
  getConnection: () => promisePool.getConnection()
};