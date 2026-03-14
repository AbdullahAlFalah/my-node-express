// For Vercel deployment, we switch to a pure JavaScript MySQL client that doesn't require native bindings, ensuring compatibility and ease of deployment.
// const mysqlpool = require('../DifferentDatabases/MySQL');
const mysqlpool = require('../DifferentDatabases/vercelMySQL');

async function runDbQuery(query, params = []) {
  const start = Date.now();
  let connection;
  
  try {

    connection = await mysqlpool.promise().getConnection();

    console.log(`[DB] Running query: ${query} | Params: ${JSON.stringify(params)}`);
    const [rows] = await connection.query(query, params);
    const duration = Date.now() - start;
    console.log(`[DB] Query succeeded in ${duration}ms`);

    return rows; // 200: OK

  } catch (err) {
    if (!connection) {
      console.error(`[DB] Could not get a client from the pool: ${err.code || 'NO_CODE'} | ${err.message}`); // Server Logs
    } else {
      console.error(`[DB] Error with client connection or Query failed: ${err.code || 'NO_CODE'} | ${err.message}`); // Server Logs
    }
    throw err; // always rethrow so caller knows
  } finally {
    if (connection) {
      try {
        connection.release(); // release if it was allocated
        console.log(`[DB] Connection released`);
      } catch (releaseErr) {
        console.error(`[DB] Failed to release client: ${releaseErr.message}`); // Server Logs
      }
    }
  }
}

module.exports = { runDbQuery };
