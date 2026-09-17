import { execute } from "../connection.js";
import { quoteIdentifier } from "../identifiers.js";

/**
 * Retrieve detailed column metadata for every table in a schema.
 *
 * Information Schema is retained here because it provides
 * considerably richer column-level metadata than SHOW TABLES.
 *
 * @param {string} databaseName - Name of the database
 * @param {string} schemaName - Name of the schema
 * @returns {Promise<Array<Object>>} Raw column rows, one per column, ordered by table then position
 */
export const getColumns = async (databaseName, schemaName) => {
  const database = quoteIdentifier(databaseName);

  return execute(`
    SELECT
      TABLE_CATALOG,
      TABLE_SCHEMA,
      TABLE_NAME,

      COLUMN_NAME,
      ORDINAL_POSITION,

      COLUMN_DEFAULT,
      IS_NULLABLE,

      DATA_TYPE,
      DATA_TYPE_ALIAS,

      CHARACTER_MAXIMUM_LENGTH,
      CHARACTER_OCTET_LENGTH,

      NUMERIC_PRECISION,
      NUMERIC_PRECISION_RADIX,
      NUMERIC_SCALE,

      IS_IDENTITY,
      IDENTITY_GENERATION,
      IDENTITY_START,
      IDENTITY_INCREMENT,
      IDENTITY_ORDERED,

      COMMENT,

      EXPRESSION,
      KIND

    FROM ${database}.INFORMATION_SCHEMA.COLUMNS

    WHERE TABLE_SCHEMA = '${String(schemaName).replaceAll("'", "''")}'

    ORDER BY
      TABLE_NAME,
      ORDINAL_POSITION
  `);
};
