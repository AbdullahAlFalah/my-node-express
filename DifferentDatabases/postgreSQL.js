const { Pool } = require('pg');

// Configure the connection pool (adjust based on your setup)
const pgsql = new Pool({
    user: 'yourUsername',
    host: 'localhost',
    database: 'yourDatabaseName',
    password: 'yourPassword',
    port: 5432, // default port for PostgreSQL
});

// Export the pool to use in other files
module.exports = pgsql;