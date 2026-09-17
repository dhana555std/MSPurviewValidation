import path from "node:path";
import { OUTPUT_DIR } from "../../utils/snowflake/output-config.js";
import { writeJson } from "../../utils/json-writer.js";
import { safeFileName } from "../../utils/file-naming.js";
import { createQualifiedName } from "../identifiers.js";
import { getColumns } from "../extractors/columns.js";

/**
 * Extract column metadata for a schema and write one JSON file per table.
 *
 * Kept separate from processSchemaLevelResource because columns are queried
 * once per schema but written once per table, and each row needs to be
 * grouped under its owning table first.
 *
 * @param {Object} context
 * @param {string} context.databaseName - Name of the database
 * @param {string} context.schemaName - Name of the schema
 * @param {string} context.accountName - Snowflake account name, used to build qualified names
 * @param {Array<Object>} context.tables - Tables already extracted for this schema
 * @param {Object} context.counts - Mutable manifest counters
 * @param {Array<Object>} context.errors - Mutable list of extraction errors
 * @returns {Promise<Array<Object>>} Flattened column rows across all tables, for the xlsx export
 */
export const processColumns = async ({
  databaseName,
  schemaName,
  accountName,
  tables,
  counts,
  errors,
}) => {
  let columns = [];

  try {
    columns = await getColumns(databaseName, schemaName);
  } catch (error) {
    console.warn(`      [SKIP] Columns: ${error.message}`);
    errors.push({
      database: databaseName,
      schema: schemaName,
      object: "columns",
      error: error.message,
    });
  }

  /*
   * Group columns by table.
   *
   * This avoids repeatedly filtering the complete
   * column collection for every table.
   */
  const columnsByTable = new Map();

  for (const column of columns) {
    const tableName = column.TABLE_NAME;

    if (!columnsByTable.has(tableName)) {
      columnsByTable.set(tableName, []);
    }

    columnsByTable.get(tableName).push({
      database: databaseName,
      schema: schemaName,
      table: tableName,

      name: column.COLUMN_NAME,

      description: column.COMMENT ?? null,

      position: column.ORDINAL_POSITION,

      dataType: column.DATA_TYPE,

      dataTypeAlias: column.DATA_TYPE_ALIAS,

      length: column.CHARACTER_MAXIMUM_LENGTH,

      byteLength: column.CHARACTER_OCTET_LENGTH,

      precision: column.NUMERIC_PRECISION,

      precisionRadix: column.NUMERIC_PRECISION_RADIX,

      scale: column.NUMERIC_SCALE,

      nullable: column.IS_NULLABLE,

      default: column.COLUMN_DEFAULT,

      isIdentity: column.IS_IDENTITY,

      identityGeneration: column.IDENTITY_GENERATION,

      identityStart: column.IDENTITY_START,

      identityIncrement: column.IDENTITY_INCREMENT,

      identityOrdered: column.IDENTITY_ORDERED,

      kind: column.KIND,

      expression: column.EXPRESSION,

      qualifiedName: createQualifiedName({
        account: accountName,
        database: databaseName,
        schema: schemaName,
        object: tableName,
        column: column.COLUMN_NAME,
      }),
    });
  }

  /*
   * One JSON file per table for columns.
   */
  const allColumns = [];

  for (const table of tables) {
    const tableColumns = columnsByTable.get(table.name) ?? [];

    counts.columns += tableColumns.length;

    await writeJson(
      path.join(
        OUTPUT_DIR,
        "columns",
        safeFileName(databaseName),
        safeFileName(schemaName),
        `${safeFileName(table.name)}.json`,
      ),
      {
        database: databaseName,
        schema: schemaName,
        table: table.name,

        qualifiedName: createQualifiedName({
          account: accountName,
          database: databaseName,
          schema: schemaName,
          object: table.name,
        }),

        columns: tableColumns,
      },
    );

    allColumns.push(...tableColumns);
  }

  return allColumns;
};
