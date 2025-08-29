const pgsqlpool = require('../DifferentDatabases/postgreSQL');

async function runPgQuery(query, params = []) {
  const start = Date.now();
  let client;

  try {

    client = await pgsqlpool.connect();

    console.log(`[PG] Running query: ${query} | Params: ${JSON.stringify(params)}`);
    const result = await client.query(query, params);
    const duration = Date.now() - start;
    console.log(`[PG] Query succeeded in ${duration}ms | Rows: ${result.rows.length}`);

    return result.rows; // 200: OK

  } catch (err) {
    if (!client) {
      console.error(`[PG] Could not get a client from the pool: ${err.code || 'NO_CODE'} | ${err.message}`); // 500: Internal Server Error
    } else {
      console.error(`[PG] Error with client connection or Query failed: ${err.code || 'NO_CODE'} | ${err.message}`); // 500: Internal Server Error
    }
    throw err; // 500: always rethrow so caller knows
  } finally {
    if (client) {
      try {
        client.release();
        console.log(`[PG] Connection released`); // release if it was allocated
      } catch (releaseErr) {
        console.error(`[PG] Failed to release client: ${releaseErr.message}`); // 500: Internal Server Error
      }
    }
  }
}

module.exports = { runPgQuery };
