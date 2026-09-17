/**
 * Convert an arbitrary object name into a filesystem-safe name.
 *
 * Source-agnostic: usable by any metadata extractor (Snowflake, Purview, ...)
 * when deriving output file/folder names from source object names.
 *
 * @param {string} value - Object name
 * @returns {string} Filesystem-safe name
 */
export const safeFileName = (value) =>
  String(value)
    .replaceAll("/", "_")
    .replaceAll("\\", "_")
    .replaceAll(":", "_")
    .replaceAll("*", "_")
    .replaceAll("?", "_")
    .replaceAll('"', "_");
