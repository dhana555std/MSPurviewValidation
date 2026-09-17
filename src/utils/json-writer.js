import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Write formatted JSON, creating parent directories as needed.
 *
 * Source-agnostic: usable by any metadata extractor (Snowflake, Purview, ...).
 *
 * @param {string} filePath - Destination file path
 * @param {any} data - JSON-serializable data
 * @returns {Promise<void>}
 */
export const writeJson = async (filePath, data) => {
  await mkdir(path.dirname(filePath), {
    recursive: true,
  });

  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
};
