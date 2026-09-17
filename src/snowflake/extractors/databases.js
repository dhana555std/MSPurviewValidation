import { execute } from "../connection.js";
import { getField } from "../identifiers.js";

/**
 * Retrieve all databases visible to the current role.
 *
 * IMPORTANT:
 * Uses SHOW DATABASES instead of
 * SNOWFLAKE.INFORMATION_SCHEMA.DATABASES.
 *
 * This allows account-level/default Snowflake databases such
 * as SNOWFLAKE to appear when the executing role can see them.
 *
 * @returns {Promise<Array<Object>>} Array of database objects
 */
export const getDatabases = async () => {
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
