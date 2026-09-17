import { execute } from "../connection.js";
import { getField, quoteIdentifier } from "../identifiers.js";

/**
 * Retrieve all schemas in a database.
 *
 * Uses SHOW SCHEMAS so special/default databases are handled
 * through Snowflake's account-level metadata commands.
 *
 * @param {string} databaseName - Name of the database
 * @returns {Promise<Array<Object>>} Array of schema objects
 */
export const getSchemas = async (databaseName) => {
  const database = quoteIdentifier(databaseName);

  const rows = await execute(`
    SHOW SCHEMAS IN DATABASE ${database}
  `);

  return rows
    .map((row) => ({
      name: getField(row, "name"),
      databaseName: getField(row, "database_name"),

      description: getField(row, "comment"),

      owner: getField(row, "owner"),
      isDefault: getField(row, "is_default"),
      isCurrent: getField(row, "is_current"),

      createdOn: getField(row, "created_on"),
      retentionTime: getField(row, "retention_time"),
    }))
    .filter(
      (schema) =>
        schema.name && schema.name.toUpperCase() !== "INFORMATION_SCHEMA",
    )
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};
