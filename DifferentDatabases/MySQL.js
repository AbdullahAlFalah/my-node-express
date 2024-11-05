const mysql = require('mysql2');

// MySQL Connection Pool
require('dotenv').config();
const fs = require('fs');
const mysqlpool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: parseInt(process.env.MYSQL_PORT, 10),
  ssl: { ca: fs.readFileSync(process.env.MYSQL_SSL_CA) }, //path to Aiven's CA certificate
  connectionLimit: 10,
  waitForConnections: true,
});

// Export the pool to use in other files
module.exports = mysqlpool;

