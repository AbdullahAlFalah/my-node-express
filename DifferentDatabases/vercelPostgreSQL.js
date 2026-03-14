const { Pool } = require('pg');
require('dotenv').config();

const pgsqlpool = new Pool({
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    port: parseInt(process.env.PG_PORT, 10), 
    // Vercel Fix: Use the environment variable string directly
    ssl: { 
        ca: process.env.PG_SSL_CA,
        rejectUnauthorized: false // Vercel Fix: Disable strict SSL verification since we can't use the CA file in the serverless environment. This is generally not recommended for production, but may be necessary in this case due to Vercel's limitations.
     },
    connectTimeout: 10000,
});

module.exports = pgsqlpool;
