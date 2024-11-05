const { Pool } = require('pg');

// PostgreSQL Connection Pool
require('dotenv').config();
const fs = require('fs');
const pgsqlpool = new Pool({
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    port: parseInt(process.env.PG_PORT, 10), 
    ssl: { ca: fs.readFileSync(process.env.PG_SSL_CA) }, //path to Aiven's CA certificate
    connectTimeout: 10000,
});

// Export the pool to use in other files
module.exports = pgsqlpool;

