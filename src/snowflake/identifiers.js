/**
 * Safely quote a Snowflake identifier.
 *
 * @param {string|number|any} value - Identifier value to quote
 * @returns {string} Quoted identifier with escaped double quotes
 */
export const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

/**
 * SHOW commands return lowercase column names.
 *
 * This helper also makes the code tolerant of uppercase
 * column names returned by SELECT statements.
 *
 * @param {Object} row - Raw row returned by the Snowflake driver
 * @param {string} field - Field name in any casing
 * @returns {any} The field value, or null if not present
 */
export const getField = (row, field) =>
  row?.[field] ??
  row?.[field.toLowerCase()] ??
  row?.[field.toUpperCase()] ??
  null;

/**
 * Build a fully qualified name for a Snowflake object.
 *
 * @param {Object} parts
 * @param {string} parts.account - Snowflake account name
 * @param {string} [parts.database] - Database name
 * @param {string} [parts.schema] - Schema name
 * @param {string} [parts.object] - Table, view, procedure, or notebook name
 * @param {string} [parts.column] - Column name
 * @returns {string} Qualified name, e.g. SNOWFLAKE://account/db/schema/table/column
 */
export const createQualifiedName = ({ account, database, schema, object, column }) => {
  const parts = ["SNOWFLAKE", account, database, schema, object, column].filter(
    Boolean,
  );

  return parts.join("://");
};
