import snowflake from "snowflake-sdk";

let connection;

/**
 * Lazily create and return the shared Snowflake connection object.
 *
 * Deferred until first use (rather than created at module load) so that
 * callers can configure the SDK's logger first — creating the connection
 * is the SDK's first opportunity to log, and doing that before logging is
 * configured would recreate the default snowflake.log in the project root.
 *
 * @returns {Object} The Snowflake connection object
 */
export const getConnection = () => {
  connection ??= snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USER,
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || "LO89899",
    role: process.env.SNOWFLAKE_ROLE || "ACCOUNTADMIN",
  });

  return connection;
};

/**
 * Connect to Snowflake.
 *
 * @returns {Promise<Object>} The underlying Snowflake connection
 */
export const connect = () =>
  new Promise((resolve, reject) => {
    getConnection().connect((error, conn) => {
      if (error) {
        reject(error);
        return;
      }

      console.log(`Connected to Snowflake: ${conn.getId()}`);
      resolve(conn);
    });
  });

/**
 * Execute SQL and return rows.
 *
 * @param {string} sqlText - SQL query to execute
 * @returns {Promise<Array<Object>>} Array of result rows
 */
export const execute = (sqlText) =>
  new Promise((resolve, reject) => {
    getConnection().execute({
      sqlText,

      complete: (error, statement, rows) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(rows ?? []);
      },
    });
  });
