import "dotenv/config";
import snowflake from "snowflake-sdk";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { configureSnowflakeLogging } from "./common/snowflake-logger.js";

await configureSnowflakeLogging();

const OUTPUT_DIR = "snowflake-metadata-output";

const connection = snowflake.createConnection({
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USER,
  password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE || "LO89899",
  role: process.env.SNOWFLAKE_ROLE || "ACCOUNTADMIN",
});

/*
 * ============================================================
 * CONNECTION
 * ============================================================
 */

const connect = () =>
  new Promise((resolve, reject) => {
    connection.connect((error, conn) => {
      if (error) {
        reject(error);
        return;
      }

      console.log(`Connected to Snowflake: ${conn.getId()}`);
      resolve(conn);
    });
  });

/*
 * ============================================================
 * SQL EXECUTION
 * ============================================================
 */

const execute = (sqlText) =>
  new Promise((resolve, reject) => {
    connection.execute({
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

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Safely quote a Snowflake identifier.
 */
const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

/**
 * SHOW commands return lowercase column names.
 *
 * This helper also makes the code tolerant of uppercase
 * column names returned by SELECT statements.
 */
const getField = (row, field) =>
  row?.[field] ??
  row?.[field.toLowerCase()] ??
  row?.[field.toUpperCase()] ??
  null;

/**
 * Write formatted JSON.
 */
const writeJson = async (filePath, data) => {
  await mkdir(path.dirname(filePath), {
    recursive: true,
  });

  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
};

/**
 * Convert a Snowflake object name into a safe filename.
 */
const safeFileName = (value) =>
  String(value)
    .replaceAll("/", "_")
    .replaceAll("\\", "_")
    .replaceAll(":", "_")
    .replaceAll("*", "_")
    .replaceAll("?", "_")
    .replaceAll('"', "_");

/*
 * ============================================================
 * DATABASES
 * ============================================================
 */

/**
 * Retrieve all databases visible to the current role.
 *
 * IMPORTANT:
 * Uses SHOW DATABASES instead of
 * SNOWFLAKE.INFORMATION_SCHEMA.DATABASES.
 *
 * This allows account-level/default Snowflake databases such
 * as SNOWFLAKE to appear when the executing role can see them.
 */
const getDatabases = async () => {
  const rows = await execute(`
    SHOW DATABASES
  `);

  return rows
    .map((row) => ({
      name: getField(row, "name"),
      description: getField(row, "comment"),

      owner: getField(row, "owner"),
      origin: getField(row, "origin"),
      kind: getField(row, "kind"),

      isDefault: getField(row, "is_default"),
      isCurrent: getField(row, "is_current"),

      createdOn: getField(row, "created_on"),
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

/*
 * ============================================================
 * SCHEMAS
 * ============================================================
 */

/**
 * Retrieve all schemas in a database.
 *
 * Uses SHOW SCHEMAS so special/default databases are handled
 * through Snowflake's account-level metadata commands.
 */
const getSchemas = async (databaseName) => {
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

/*
 * ============================================================
 * TABLES
 * ============================================================
 */

/**
 * Retrieve all tables in a schema.
 *
 * SHOW TABLES is used instead of querying INFORMATION_SCHEMA.TABLES
 * for object discovery.
 */
const getTables = async (databaseName, schemaName) => {
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

/*
 * ============================================================
 * COLUMNS
 * ============================================================
 */

/**
 * Retrieve detailed column metadata.
 *
 * Information Schema is retained here because it provides
 * considerably richer column-level metadata than SHOW TABLES.
 */
const getColumns = async (databaseName, schemaName) => {
  const database = quoteIdentifier(databaseName);
  const schema = quoteIdentifier(schemaName);

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

/*
 * ============================================================
 * VIEWS
 * ============================================================
 */

/**
 * Retrieve all views in a schema.
 */
const getViews = async (databaseName, schemaName) => {
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

/*
 * ============================================================
 * PROCEDURES
 * ============================================================
 */

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
 */
const getProcedures = async (databaseName, schemaName) => {
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

/*
 * ============================================================
 * NOTEBOOKS
 * ============================================================
 */

const getNotebooks = async () => {
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

/*
 * ============================================================
 * QUALIFIED NAME
 * ============================================================
 */

const createQualifiedName = ({ account, database, schema, object, column }) => {
  const parts = ["SNOWFLAKE", account, database, schema, object, column].filter(
    Boolean,
  );

  return parts.join("://");
};

/*
 * ============================================================
 * XLSX EXPORT
 * ============================================================
 */

const XLSX_FILE_NAME = "snowflake-metadata-results.xlsx";

const DATABASE_COLUMNS = [
  { header: "Name", key: "name", width: 30 },
  { header: "Description", key: "description", width: 40 },
  { header: "Owner", key: "owner", width: 20 },
  { header: "Origin", key: "origin", width: 20 },
  { header: "Kind", key: "kind", width: 15 },
  { header: "Is Default", key: "isDefault", width: 12 },
  { header: "Is Current", key: "isCurrent", width: 12 },
  { header: "Created On", key: "createdOn", width: 22 },
  { header: "Qualified Name", key: "qualifiedName", width: 60 },
];

const SCHEMA_COLUMNS = [
  { header: "Name", key: "name", width: 30 },
  { header: "Database", key: "databaseName", width: 25 },
  { header: "Description", key: "description", width: 40 },
  { header: "Owner", key: "owner", width: 20 },
  { header: "Is Default", key: "isDefault", width: 12 },
  { header: "Is Current", key: "isCurrent", width: 12 },
  { header: "Created On", key: "createdOn", width: 22 },
  { header: "Retention Time", key: "retentionTime", width: 15 },
  { header: "Qualified Name", key: "qualifiedName", width: 60 },
];

const TABLE_COLUMNS = [
  { header: "Name", key: "name", width: 30 },
  { header: "Database", key: "databaseName", width: 25 },
  { header: "Schema", key: "schemaName", width: 25 },
  { header: "Description", key: "description", width: 40 },
  { header: "Kind", key: "kind", width: 15 },
  { header: "Owner", key: "owner", width: 20 },
  { header: "Created On", key: "createdOn", width: 22 },
  { header: "Rows", key: "rows", width: 12 },
  { header: "Bytes", key: "bytes", width: 15 },
  { header: "Is Temporary", key: "isTemporary", width: 12 },
  { header: "Is Transient", key: "isTransient", width: 12 },
  { header: "Is Iceberg", key: "isIceberg", width: 12 },
  { header: "Qualified Name", key: "qualifiedName", width: 60 },
];

const COLUMN_COLUMNS = [
  { header: "Database", key: "database", width: 25 },
  { header: "Schema", key: "schema", width: 25 },
  { header: "Table", key: "table", width: 30 },
  { header: "Column", key: "name", width: 30 },
  { header: "Description", key: "description", width: 40 },
  { header: "Position", key: "position", width: 10 },
  { header: "Data Type", key: "dataType", width: 18 },
  { header: "Data Type Alias", key: "dataTypeAlias", width: 18 },
  { header: "Length", key: "length", width: 10 },
  { header: "Byte Length", key: "byteLength", width: 12 },
  { header: "Precision", key: "precision", width: 10 },
  { header: "Precision Radix", key: "precisionRadix", width: 14 },
  { header: "Scale", key: "scale", width: 10 },
  { header: "Nullable", key: "nullable", width: 10 },
  { header: "Default", key: "default", width: 20 },
  { header: "Is Identity", key: "isIdentity", width: 12 },
  { header: "Identity Generation", key: "identityGeneration", width: 18 },
  { header: "Identity Start", key: "identityStart", width: 14 },
  { header: "Identity Increment", key: "identityIncrement", width: 16 },
  { header: "Identity Ordered", key: "identityOrdered", width: 14 },
  { header: "Kind", key: "kind", width: 15 },
  { header: "Expression", key: "expression", width: 30 },
  { header: "Qualified Name", key: "qualifiedName", width: 70 },
];

const VIEW_COLUMNS = [
  { header: "Name", key: "name", width: 30 },
  { header: "Database", key: "databaseName", width: 25 },
  { header: "Schema", key: "schemaName", width: 25 },
  { header: "Description", key: "description", width: 40 },
  { header: "Owner", key: "owner", width: 20 },
  { header: "Is Secure", key: "isSecure", width: 12 },
  { header: "Created On", key: "createdOn", width: 22 },
  { header: "Qualified Name", key: "qualifiedName", width: 60 },
];

const PROCEDURE_COLUMNS = [
  { header: "Name", key: "name", width: 30 },
  { header: "Database", key: "databaseName", width: 25 },
  { header: "Schema", key: "schemaName", width: 25 },
  { header: "Description", key: "description", width: 40 },
  { header: "Arguments", key: "arguments", width: 40 },
  { header: "Min Arguments", key: "minArguments", width: 14 },
  { header: "Max Arguments", key: "maxArguments", width: 14 },
  { header: "Is Builtin", key: "isBuiltin", width: 12 },
  { header: "Is Aggregate", key: "isAggregate", width: 12 },
  { header: "Is Ansi", key: "isAnsi", width: 12 },
  { header: "Is Table Function", key: "isTableFunction", width: 16 },
  { header: "Is Secure", key: "isSecure", width: 12 },
  { header: "Created On", key: "createdOn", width: 22 },
  { header: "Qualified Name", key: "qualifiedName", width: 60 },
];

const NOTEBOOK_COLUMNS = [
  { header: "Name", key: "name", width: 30 },
  { header: "Database", key: "database", width: 25 },
  { header: "Schema", key: "schema", width: 25 },
  { header: "Description", key: "description", width: 40 },
  { header: "Owner", key: "owner", width: 20 },
  { header: "Query Warehouse", key: "queryWarehouse", width: 20 },
  { header: "Code Warehouse", key: "codeWarehouse", width: 20 },
  { header: "URL Id", key: "urlId", width: 30 },
  { header: "Created On", key: "createdOn", width: 22 },
  { header: "Qualified Name", key: "qualifiedName", width: 60 },
];

const ERROR_COLUMNS = [
  { header: "Database", key: "database", width: 25 },
  { header: "Schema", key: "schema", width: 25 },
  { header: "Object", key: "object", width: 15 },
  { header: "Error", key: "error", width: 70 },
];

/**
 * Add a tabular worksheet with a bold, frozen header row.
 */
const addTableSheet = (workbook, name, columns, rows) => {
  const sheet = workbook.addWorksheet(name);

  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  for (const row of rows) {
    sheet.addRow(row);
  }
};

/**
 * Add the manifest as a key/value summary sheet.
 */
const addManifestSheet = (workbook, manifest) => {
  const sheet = workbook.addWorksheet("Manifest");

  sheet.columns = [
    { header: "Field", key: "field", width: 25 },
    { header: "Value", key: "value", width: 70 },
  ];
  sheet.getRow(1).font = { bold: true };

  sheet.addRow({ field: "Source", value: manifest.source });
  sheet.addRow({ field: "Extracted At", value: manifest.extractedAt });
  sheet.addRow({ field: "Account", value: manifest.account });
  sheet.addRow({ field: "Output Format", value: manifest.outputFormat });
  sheet.addRow({ field: "Output Directory", value: OUTPUT_DIR });
  sheet.addRow({});

  sheet.addRow({ field: "Counts" }).font = { bold: true };
  for (const [key, value] of Object.entries(manifest.counts)) {
    sheet.addRow({ field: key, value });
  }
  sheet.addRow({});

  sheet.addRow({
    field: "Errors",
    value: manifest.errors?.length ?? 0,
  });
  sheet.addRow({});

  sheet.addRow({ field: "JSON Output Structure" }).font = { bold: true };
  for (const [key, value] of Object.entries(manifest.structure)) {
    sheet.addRow({ field: key, value });
  }
};

/**
 * Build the multi-tab workbook and write it to disk.
 *
 * Manifest is added first so it is the leftmost/active tab when opened.
 */
const writeWorkbook = async ({
  manifest,
  databases,
  schemas,
  tables,
  columns,
  views,
  procedures,
  notebooks,
  errors,
}) => {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Snowflake Metadata Extraction";
  workbook.created = new Date();

  addManifestSheet(workbook, manifest);
  addTableSheet(workbook, "Databases", DATABASE_COLUMNS, databases);
  addTableSheet(workbook, "Schemas", SCHEMA_COLUMNS, schemas);
  addTableSheet(workbook, "Tables", TABLE_COLUMNS, tables);
  addTableSheet(workbook, "Columns", COLUMN_COLUMNS, columns);
  addTableSheet(workbook, "Views", VIEW_COLUMNS, views);
  addTableSheet(workbook, "Procedures", PROCEDURE_COLUMNS, procedures);
  addTableSheet(workbook, "Notebooks", NOTEBOOK_COLUMNS, notebooks);

  if (errors.length > 0) {
    addTableSheet(workbook, "Errors", ERROR_COLUMNS, errors);
  }

  const filePath = path.join(OUTPUT_DIR, XLSX_FILE_NAME);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await workbook.xlsx.writeFile(filePath);

  return filePath;
};

/*
 * ============================================================
 * EXTRACT METADATA
 * ============================================================
 */

const extractMetadata = async () => {
  console.log("\nRetrieving databases...");

  const databases = await getDatabases();

  console.log(`Found ${databases.length} databases.`);

  /*
   * Account information
   */
  const accountName = process.env.SNOWFLAKE_ACCOUNT || "UNKNOWN";

  /*
   * Manifest counters
   */
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

  /*
   * Flat accumulators used to build the xlsx workbook once
   * extraction completes.
   */
  const allSchemas = [];
  const allTables = [];
  const allColumns = [];
  const allViews = [];
  const allProcedures = [];

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

    /*
     * Write schema metadata
     */
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

      /*
       * --------------------------------------------------------
       * TABLES
       * --------------------------------------------------------
       */

      let tables = [];

      try {
        tables = await getTables(databaseName, schemaName);
      } catch (error) {
        console.warn(`      [SKIP] Tables: ${error.message}`);
        errors.push({ database: databaseName, schema: schemaName, object: "tables", error: error.message });
      }

      console.log(`      Tables: ${tables.length}`);

      counts.tables += tables.length;

      const tableRows = tables.map((table) => ({
        ...table,

        qualifiedName: createQualifiedName({
          account: accountName,
          database: databaseName,
          schema: schemaName,
          object: table.name,
        }),
      }));

      await writeJson(
        path.join(
          OUTPUT_DIR,
          "tables",
          safeFileName(databaseName),
          safeFileName(schemaName),
          "tables.json",
        ),
        tableRows,
      );

      allTables.push(...tableRows);

      /*
       * --------------------------------------------------------
       * COLUMNS
       * --------------------------------------------------------
       */

      let columns = [];

      try {
        columns = await getColumns(databaseName, schemaName);
      } catch (error) {
        console.warn(`      [SKIP] Columns: ${error.message}`);
        errors.push({ database: databaseName, schema: schemaName, object: "columns", error: error.message });
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

      /*
       * --------------------------------------------------------
       * VIEWS
       * --------------------------------------------------------
       */

      let views = [];

      try {
        views = await getViews(databaseName, schemaName);
      } catch (error) {
        console.warn(`      [SKIP] Views: ${error.message}`);
        errors.push({ database: databaseName, schema: schemaName, object: "views", error: error.message });
      }

      console.log(`      Views: ${views.length}`);

      counts.views += views.length;

      const viewRows = views.map((view) => ({
        ...view,

        qualifiedName: createQualifiedName({
          account: accountName,
          database: databaseName,
          schema: schemaName,
          object: view.name,
        }),
      }));

      await writeJson(
        path.join(
          OUTPUT_DIR,
          "views",
          safeFileName(databaseName),
          safeFileName(schemaName),
          "views.json",
        ),
        viewRows,
      );

      allViews.push(...viewRows);

      /*
       * --------------------------------------------------------
       * PROCEDURES
       * --------------------------------------------------------
       */

      let procedures = [];

      try {
        procedures = await getProcedures(databaseName, schemaName);
      } catch (error) {
        console.warn(`      [SKIP] Procedures: ${error.message}`);
        errors.push({ database: databaseName, schema: schemaName, object: "procedures", error: error.message });
      }

      console.log(`      Procedures: ${procedures.length}`);

      counts.procedures += procedures.length;

      const procedureRows = procedures.map((procedure) => ({
        ...procedure,

        qualifiedName: createQualifiedName({
          account: accountName,
          database: databaseName,
          schema: schemaName,
          object: procedure.name,
        }),
      }));

      await writeJson(
        path.join(
          OUTPUT_DIR,
          "procedures",
          safeFileName(databaseName),
          safeFileName(schemaName),
          "procedures.json",
        ),
        procedureRows,
      );

      allProcedures.push(...procedureRows);
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
    tables: allTables,
    columns: allColumns,
    views: allViews,
    procedures: allProcedures,
    notebooks: notebookRows,
    errors,
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

/*
 * ============================================================
 * MAIN
 * ============================================================
 */

const main = async () => {
  try {
    await connect();

    await extractMetadata();
  } catch (error) {
    console.error("\nMetadata extraction failed:");

    console.error(error);

    process.exitCode = 1;
  } finally {
    connection.destroy((error) => {
      if (error) {
        console.error("Error closing Snowflake connection:", error);
      } else {
        console.log("Snowflake connection closed.");
      }
    });
  }
};

await main();
