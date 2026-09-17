import { getTables } from "./tables.js";
import { getViews } from "./views.js";
import { getProcedures } from "./procedures.js";

/**
 * Registry of schema-scoped Snowflake object types that share an identical
 * shape: a SHOW ... IN SCHEMA extractor, one JSON file per schema, and one
 * flat row list for the xlsx export.
 *
 * Open/Closed: to support a new schema-scoped object type (e.g. functions,
 * sequences, stages), add an entry here. The extraction loop in
 * extract-metadata.js and the generic processor in
 * processing/process-schema-resource.js require no changes.
 *
 * `key` doubles as the manifest counts key and the xlsx data key, so it
 * must be unique and stable.
 */
export const SCHEMA_LEVEL_RESOURCES = [
  {
    key: "tables",
    label: "Tables",
    extract: getTables,
    folderName: "tables",
    fileName: "tables.json",
  },
  {
    key: "views",
    label: "Views",
    extract: getViews,
    folderName: "views",
    fileName: "views.json",
  },
  {
    key: "procedures",
    label: "Procedures",
    extract: getProcedures,
    folderName: "procedures",
    fileName: "procedures.json",
  },
];
