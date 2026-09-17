import { execute } from "../connection.js";
import { getField } from "../identifiers.js";

/**
 * Retrieve all Snowflake notebooks in the account.
 *
 * @returns {Promise<Array<Object>>} Array of notebook objects
 */
export const getNotebooks = async () => {
  const rows = await execute(`
    SHOW NOTEBOOKS IN ACCOUNT
  `);

  return rows
    .map((row) => ({
      name: getField(row, "name"),
      database: getField(row, "database_name"),
      schema: getField(row, "schema_name"),

      description: getField(row, "comment"),

      owner: getField(row, "owner"),

      queryWarehouse: getField(row, "query_warehouse"),
      codeWarehouse: getField(row, "code_warehouse"),

      urlId: getField(row, "url_id"),

      createdOn: getField(row, "created_on"),
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};
