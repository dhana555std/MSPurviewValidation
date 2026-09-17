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

/**
 * Columns for the dedicated Errors sheet, added only when extraction
 * skipped at least one object.
 */
export const ERROR_COLUMNS = [
  { header: "Database", key: "database", width: 25 },
  { header: "Schema", key: "schema", width: 25 },
  { header: "Object", key: "object", width: 15 },
  { header: "Error", key: "error", width: 70 },
];

/**
 * Registry driving every non-manifest tab in the xlsx workbook.
 *
 * Open/Closed: to add a new tab, add an entry here with the sheet's
 * display name, its column definitions, and the key under which its rows
 * are passed into writeWorkbook(). workbook-builder.js iterates this list
 * generically and needs no changes.
 */
export const SHEET_DEFINITIONS = [
  { name: "Databases", columns: DATABASE_COLUMNS, dataKey: "databases" },
  { name: "Schemas", columns: SCHEMA_COLUMNS, dataKey: "schemas" },
  { name: "Tables", columns: TABLE_COLUMNS, dataKey: "tables" },
  { name: "Columns", columns: COLUMN_COLUMNS, dataKey: "columns" },
  { name: "Views", columns: VIEW_COLUMNS, dataKey: "views" },
  { name: "Procedures", columns: PROCEDURE_COLUMNS, dataKey: "procedures" },
  { name: "Notebooks", columns: NOTEBOOK_COLUMNS, dataKey: "notebooks" },
];
