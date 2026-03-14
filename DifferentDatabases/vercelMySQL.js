const mysql = require('mysql2');
require('dotenv').config();

const mysqlpool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: parseInt(process.env.MYSQL_PORT, 10),
  // Vercel Fix: Use the environment variable string directly
  ssl: { 
    ca: process.env.MYSQL_SSL_CA,
    rejectUnauthorized: false // Vercel Fix: Disable strict SSL verification since we can't use the CA file in the serverless environment. This is generally not recommended for production, but may be necessary in this case due to Vercel's limitations.
   }, 
  waitForConnections: true,
});

module.exports = mysqlpool;
