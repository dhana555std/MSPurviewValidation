import { execute } from "../connection.js";
import { getField, quoteIdentifier } from "../identifiers.js";

/**
 * Retrieve all views in a schema.
 *
 * @param {string} databaseName - Name of the database
 * @param {string} schemaName - Name of the schema
 * @returns {Promise<Array<Object>>} Array of view objects
 */
export const getViews = async (databaseName, schemaName) => {
  const database = quoteIdentifier(databaseName);
  const schema = quoteIdentifier(schemaName);

  const rows = await execute(`
    SHOW VIEWS IN SCHEMA ${database}.${schema}
  `);

  return rows
    .map((row) => ({
      name: getField(row, "name"),
      databaseName: getField(row, "database_name"),
      schemaName: getField(row, "schema_name"),

      description: getField(row, "comment") ?? getField(row, "description"),

      owner: getField(row, "owner"),

      isSecure: getField(row, "is_secure"),

      createdOn: getField(row, "created_on"),
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};
