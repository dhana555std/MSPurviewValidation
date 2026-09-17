import { execute } from "../connection.js";
import { getField, quoteIdentifier } from "../identifiers.js";

/**
 * Retrieve all tables in a schema.
 *
 * SHOW TABLES is used instead of querying INFORMATION_SCHEMA.TABLES
 * for object discovery.
 *
 * @param {string} databaseName - Name of the database
 * @param {string} schemaName - Name of the schema
 * @returns {Promise<Array<Object>>} Array of table objects
 */
export const getTables = async (databaseName, schemaName) => {
  const database = quoteIdentifier(databaseName);
  const schema = quoteIdentifier(schemaName);

  const rows = await execute(`
    SHOW TABLES IN SCHEMA ${database}.${schema}
  `);

  return rows
    .map((row) => ({
      name: getField(row, "name"),
      databaseName: getField(row, "database_name"),
      schemaName: getField(row, "schema_name"),

      description: getField(row, "comment"),

      kind: getField(row, "kind"),
      owner: getField(row, "owner"),

      createdOn: getField(row, "created_on"),
      rows: getField(row, "rows"),
      bytes: getField(row, "bytes"),

      isTemporary: getField(row, "is_temporary"),
      isTransient: getField(row, "is_transient"),
      isIceberg: getField(row, "is_iceberg"),
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};
