import { execute } from "../connection.js";
import { getField, quoteIdentifier } from "../identifiers.js";

/**
 * Retrieve all procedures in a schema.
 *
 * SHOW PROCEDURES exposes:
 * - name
 * - schema
 * - catalog/database
 * - arguments
 * - description
 * - return information
 * - security information
 *
 * @param {string} databaseName - Name of the database
 * @param {string} schemaName - Name of the schema
 * @returns {Promise<Array<Object>>} Array of procedure objects
 */
export const getProcedures = async (databaseName, schemaName) => {
  const database = quoteIdentifier(databaseName);
  const schema = quoteIdentifier(schemaName);

  const rows = await execute(`
    SHOW PROCEDURES IN SCHEMA ${database}.${schema}
  `);

  return rows
    .map((row) => ({
      name: getField(row, "name"),

      databaseName: getField(row, "catalog_name"),
      schemaName: getField(row, "schema_name"),

      description: getField(row, "description") ?? getField(row, "comment"),

      arguments: getField(row, "arguments"),

      minArguments: getField(row, "min_num_arguments"),
      maxArguments: getField(row, "max_num_arguments"),

      isBuiltin: getField(row, "is_builtin"),
      isAggregate: getField(row, "is_aggregate"),
      isAnsi: getField(row, "is_ansi"),

      isTableFunction: getField(row, "is_table_function"),
      isSecure: getField(row, "is_secure"),

      createdOn: getField(row, "created_on"),
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};
