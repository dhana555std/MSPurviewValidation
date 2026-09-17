import "dotenv/config";
import { configureSnowflakeLogging } from "./utils/snowflake/logger.js";
import { getConnection, connect } from "./snowflake/connection.js";
import { extractMetadata } from "./snowflake/extract-metadata.js";

await configureSnowflakeLogging();

/*
 * ============================================================
 * MAIN
 * ============================================================
 */

/**
 * Connect to Snowflake, extract the full metadata hierarchy, and always
 * close the connection afterward regardless of outcome.
 *
 * @returns {Promise<void>}
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
    getConnection().destroy((error) => {
      if (error) {
        console.error("Error closing Snowflake connection:", error);
      } else {
        console.log("Snowflake connection closed.");
      }
    });
  }
};

await main();
