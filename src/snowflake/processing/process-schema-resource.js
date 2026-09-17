import path from "node:path";
import { OUTPUT_DIR } from "../../utils/snowflake/output-config.js";
import { writeJson } from "../../utils/json-writer.js";
import { safeFileName } from "../../utils/file-naming.js";
import { createQualifiedName } from "../identifiers.js";

/**
 * Extract, persist, and flatten a single schema-scoped resource (tables,
 * views, procedures, or any future entry in SCHEMA_LEVEL_RESOURCES) for
 * one schema.
 *
 * Extraction failures are caught and reported through `errors` rather than
 * thrown, so a permission issue on one object type does not prevent the
 * rest of the schema (or the rest of the account) from being processed.
 *
 * @param {Object} resource - Entry from SCHEMA_LEVEL_RESOURCES
 * @param {Object} context
 * @param {string} context.databaseName - Name of the database
 * @param {string} context.schemaName - Name of the schema
 * @param {string} context.accountName - Snowflake account name, used to build qualified names
 * @param {Object} context.counts - Mutable manifest counters, keyed by resource.key
 * @param {Array<Object>} context.errors - Mutable list of extraction errors
 * @returns {Promise<Array<Object>>} Flattened rows with qualifiedName attached
 */
export const processSchemaLevelResource = async (
  resource,
  { databaseName, schemaName, accountName, counts, errors },
) => {
  let items = [];

  try {
    items = await resource.extract(databaseName, schemaName);
  } catch (error) {
    console.warn(`      [SKIP] ${resource.label}: ${error.message}`);
    errors.push({
      database: databaseName,
      schema: schemaName,
      object: resource.key,
      error: error.message,
    });
  }

  console.log(`      ${resource.label}: ${items.length}`);

  counts[resource.key] += items.length;

  const rows = items.map((item) => ({
    ...item,

    qualifiedName: createQualifiedName({
      account: accountName,
      database: databaseName,
      schema: schemaName,
      object: item.name,
    }),
  }));

  await writeJson(
    path.join(
      OUTPUT_DIR,
      resource.folderName,
      safeFileName(databaseName),
      safeFileName(schemaName),
      resource.fileName,
    ),
    rows,
  );

  return rows;
};
