import snowflake from "snowflake-sdk";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const LOG_DIR = "snowflake-logs";

/**
 * Ensure the Snowflake log directory exists and configure the SDK to write
 * its log file there instead of the project root.
 *
 * @returns {Promise<void>}
 */
export const configureSnowflakeLogging = async () => {
  await mkdir(LOG_DIR, { recursive: true });

  snowflake.configure({
    logLevel: "DEBUG",
    logFilePath: join(LOG_DIR, "snowflake.log"),
  });
};
