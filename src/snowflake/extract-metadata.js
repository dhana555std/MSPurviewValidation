import path from "node:path";
import { rm } from "node:fs/promises";
import { OUTPUT_DIR, XLSX_FILE_NAME } from "../utils/snowflake/output-config.js";
import { writeJson } from "../utils/json-writer.js";
import { safeFileName } from "../utils/file-naming.js";
import { createQualifiedName } from "./identifiers.js";
import { getDatabases } from "./extractors/databases.js";
import { getSchemas } from "./extractors/schemas.js";
import { getNotebooks } from "./extractors/notebooks.js";
import { SCHEMA_LEVEL_RESOURCES } from "./extractors/schema-resources.js";
import { processSchemaLevelResource } from "./processing/process-schema-resource.js";
import { processColumns } from "./processing/process-columns.js";
import { writeWorkbook } from "./xlsx/workbook-builder.js";

const TABLES_RESOURCE = SCHEMA_LEVEL_RESOURCES.find(
  (resource) => resource.key === "tables",
);
const OTHER_SCHEMA_RESOURCES = SCHEMA_LEVEL_RESOURCES.filter(
  (resource) => resource.key !== "tables",
);

/**
 * Extract the full Snowflake metadata hierarchy (databases, schemas, tables,
 * columns, views, procedures, notebooks), writing partitioned JSON files and
 * a consolidated xlsx workbook under OUTPUT_DIR.
 *
 * Any single database, schema, or object type that fails to extract (e.g.
 * missing privileges) is skipped and recorded in `errors` rather than
 * aborting the whole run.
 *
 * @returns {Promise<{counts: Object, manifest: Object}>}
 */
export const extractMetadata = async () => {
  console.log(`\nCleaning output directory: ${OUTPUT_DIR}`);
  await rm(OUTPUT_DIR, { recursive: true, force: true });

  console.log("\nRetrieving databases...");

  const databases = await getDatabases();

  console.log(`Found ${databases.length} databases.`);

  const accountName = process.env.SNOWFLAKE_ACCOUNT || "UNKNOWN";

  const counts = {
    databases: 0,
    schemas: 0,
    tables: 0,
    columns: 0,
    views: 0,
    procedures: 0,
    notebooks: 0,
  };

  const errors = [];

  const allSchemas = [];
  const allColumns = [];

  /*
   * One flat row accumulator per registered schema-level resource
   * (tables, views, procedures, ...), keyed by resource.key.
   */
  const resourceRows = Object.fromEntries(
    SCHEMA_LEVEL_RESOURCES.map((resource) => [resource.key, []]),
  );

  /*
   * ------------------------------------------------------------
   * DATABASES
   * ------------------------------------------------------------
   */

  const databaseRows = databases.map((database) => ({
    ...database,

    qualifiedName: createQualifiedName({
      account: accountName,
      database: database.name,
    }),
  }));

  await writeJson(
    path.join(OUTPUT_DIR, "databases", "databases.json"),
    databaseRows,
  );

  counts.databases = databases.length;

  /*
   * ------------------------------------------------------------
   * DATABASE PROCESSING
   * ------------------------------------------------------------
   */

  for (const database of databases) {
    const databaseName = database.name;

    console.log(`\nDatabase: ${databaseName}`);

    /*
     * Get schemas — skip the database entirely if this fails
     * (e.g. the role has no USAGE on the database).
     */
    let schemas;

    try {
      schemas = await getSchemas(databaseName);
    } catch (error) {
      console.warn(`  [SKIP] Could not retrieve schemas: ${error.message}`);
      errors.push({ database: databaseName, error: error.message });
      continue;
    }

    console.log(`  Schemas: ${schemas.length}`);

    counts.schemas += schemas.length;

    const schemaRows = schemas.map((schema) => ({
      ...schema,

      qualifiedName: createQualifiedName({
        account: accountName,
        database: databaseName,
        schema: schema.name,
      }),
    }));

    await writeJson(
      path.join(
        OUTPUT_DIR,
        "schemas",
        safeFileName(databaseName),
        "schemas.json",
      ),
      schemaRows,
    );

    allSchemas.push(...schemaRows);

    /*
     * ----------------------------------------------------------
     * SCHEMA PROCESSING
     * ----------------------------------------------------------
     */

    for (const schema of schemas) {
      const schemaName = schema.name;

      console.log(`    Schema: ${schemaName}`);

      const context = { databaseName, schemaName, accountName, counts, errors };

      /*
       * Tables run first — columns need the resulting table list to know
       * which per-table JSON files to write.
       */
      const tableRows = await processSchemaLevelResource(
        TABLES_RESOURCE,
        context,
      );
      resourceRows.tables.push(...tableRows);

      const columnRows = await processColumns({
        ...context,
        tables: tableRows,
      });
      allColumns.push(...columnRows);

      for (const resource of OTHER_SCHEMA_RESOURCES) {
        const rows = await processSchemaLevelResource(resource, context);
        resourceRows[resource.key].push(...rows);
      }
    }
  }

  /*
   * ------------------------------------------------------------
   * NOTEBOOKS
   * ------------------------------------------------------------
   */

  console.log("\nRetrieving notebooks...");

  const notebooks = await getNotebooks();

  counts.notebooks = notebooks.length;

  const notebookRows = notebooks.map((notebook) => ({
    ...notebook,

    qualifiedName: createQualifiedName({
      account: accountName,
      database: notebook.database,
      schema: notebook.schema,
      object: notebook.name,
    }),
  }));

  await writeJson(
    path.join(OUTPUT_DIR, "notebooks", "notebooks.json"),
    notebookRows,
  );

  /*
   * ------------------------------------------------------------
   * MANIFEST
   * ------------------------------------------------------------
   */

  const manifest = {
    source: "Snowflake",

    extractedAt: new Date().toISOString(),

    account: accountName,

    outputFormat: "partitioned-json",

    counts,

    errors: errors.length > 0 ? errors : undefined,

    structure: {
      databases: "databases/databases.json",

      schemas: "schemas/<DATABASE>/schemas.json",

      tables: "tables/<DATABASE>/<SCHEMA>/tables.json",

      columns: "columns/<DATABASE>/<SCHEMA>/<TABLE>.json",

      views: "views/<DATABASE>/<SCHEMA>/views.json",

      procedures: "procedures/<DATABASE>/<SCHEMA>/procedures.json",

      notebooks: "notebooks/notebooks.json",

      xlsx: XLSX_FILE_NAME,
    },
  };

  await writeJson(path.join(OUTPUT_DIR, "manifest.json"), manifest);

  /*
   * ------------------------------------------------------------
   * XLSX WORKBOOK
   * ------------------------------------------------------------
   */

  console.log("\nWriting xlsx workbook...");

  const xlsxPath = await writeWorkbook({
    manifest,
    databases: databaseRows,
    schemas: allSchemas,
    columns: allColumns,
    notebooks: notebookRows,
    errors,
    ...resourceRows,
  });

  /*
   * ------------------------------------------------------------
   * SUMMARY
   * ------------------------------------------------------------
   */

  console.log("\n========================================");
  console.log("Snowflake Metadata Extraction Complete");
  console.log("========================================");

  console.log(`Databases   : ${counts.databases}`);

  console.log(`Schemas     : ${counts.schemas}`);

  console.log(`Tables      : ${counts.tables}`);

  console.log(`Columns     : ${counts.columns}`);

  console.log(`Views       : ${counts.views}`);

  console.log(`Procedures  : ${counts.procedures}`);

  console.log(`Notebooks   : ${counts.notebooks}`);

  console.log(`\nOutput directory: ${OUTPUT_DIR}`);
  console.log(`XLSX workbook    : ${xlsxPath}`);

  if (errors.length > 0) {
    console.warn(`\nSkipped (${errors.length} errors — see manifest.json for details):`);
    for (const { database, schema, object, error } of errors) {
      const location = [database, schema, object].filter(Boolean).join(" / ");
      console.warn(`  ${location}: ${error}`);
    }
  }

  return {
    counts,
    manifest,
  };
};
