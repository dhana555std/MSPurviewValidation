import { mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { OUTPUT_DIR, XLSX_FILE_NAME } from "../../utils/snowflake/output-config.js";
import { SHEET_DEFINITIONS, ERROR_COLUMNS } from "./sheet-columns.js";

/**
 * Add a tabular worksheet with a bold, frozen header row.
 *
 * @param {ExcelJS.Workbook} workbook
 * @param {string} name - Sheet name
 * @param {Array<Object>} columns - ExcelJS column definitions
 * @param {Array<Object>} rows - Row data
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
 *
 * @param {ExcelJS.Workbook} workbook
 * @param {Object} manifest
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
 * Every other tab is driven by SHEET_DEFINITIONS — adding a new schema-level
 * resource type only requires a new entry there plus its rows in `data`.
 *
 * @param {Object} data
 * @param {Object} data.manifest
 * @param {Array<Object>} [data.errors] - Extraction errors, rendered as an extra Errors tab when non-empty
 * @returns {Promise<string>} Path to the written xlsx file
 */
export const writeWorkbook = async (data) => {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Snowflake Metadata Extraction";
  workbook.created = new Date();

  addManifestSheet(workbook, data.manifest);

  for (const { name, columns, dataKey } of SHEET_DEFINITIONS) {
    addTableSheet(workbook, name, columns, data[dataKey] ?? []);
  }

  if (data.errors?.length > 0) {
    addTableSheet(workbook, "Errors", ERROR_COLUMNS, data.errors);
  }

  const filePath = path.join(OUTPUT_DIR, XLSX_FILE_NAME);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await workbook.xlsx.writeFile(filePath);

  return filePath;
};
