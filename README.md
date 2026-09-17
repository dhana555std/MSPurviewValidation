# Snowflake Metadata Extraction

Extracts metadata from a Snowflake account (databases, schemas, tables, columns, views, stored procedures, and notebooks) and writes the results as partitioned JSON files and a single consolidated Excel workbook.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | >= 20 |
| npm | >= 9 (bundled with Node.js 20) |
| Snowflake account | role with `SHOW` and `INFORMATION_SCHEMA` access |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the environment file

Create a file named `.env` in the project root (it is git-ignored):

```env
SNOWFLAKE_ACCOUNT=<your-account-identifier>
SNOWFLAKE_USER=<your-username>
SNOWFLAKE_PASSWORD=<your-password>
SNOWFLAKE_WAREHOUSE=<your-warehouse>
SNOWFLAKE_ROLE=<your-role>
```

**Finding your account identifier:** In Snowsight, go to **Admin → Accounts** and copy the account identifier (format: `orgname-accountname`). Do not include the `.snowflakecomputing.com` suffix.

---

## Running

```bash
npm start
```

Each run **clears and regenerates** the output directory from scratch.

---

## Output

All output is written to `snowflake-metadata-output/` in the project root.

```
snowflake-metadata-output/
  manifest.json                          # Run summary: counts, errors, file map
  snowflake-metadata-results.xlsx        # Consolidated workbook (one tab per entity type)
  databases/
    databases.json
  schemas/
    <DATABASE>/
      schemas.json
  tables/
    <DATABASE>/<SCHEMA>/
      tables.json
  columns/
    <DATABASE>/<SCHEMA>/
      <TABLE>.json
  views/
    <DATABASE>/<SCHEMA>/
      views.json
  procedures/
    <DATABASE>/<SCHEMA>/
      procedures.json
  notebooks/
    notebooks.json
```

The Excel workbook contains the following tabs:

- **Manifest** — run metadata (account, timestamp, counts, errors)
- **Databases**
- **Schemas**
- **Tables**
- **Columns**
- **Views**
- **Procedures**
- **Notebooks**
- **Errors** *(only present when extraction errors occurred)*

---

## Project Structure

```
src/
  index.js                     # Entry point — orchestrates the full extraction
  utils/
    file-naming.js             # Filesystem-safe name helper (source-agnostic)
    json-writer.js             # JSON write utility (source-agnostic)
    snowflake/
      logger.js                # Snowflake SDK log configuration
      output-config.js         # Output directory and filename constants
  snowflake/
    connection.js              # Snowflake connection and query helpers
    extract-metadata.js        # Extraction orchestrator
    identifiers.js             # Qualified name builder and SQL helpers
    extractors/                # One file per Snowflake object type
    processing/                # Per-schema write logic (tables, columns, etc.)
    xlsx/                      # Excel workbook builder and column definitions
```

---

## Logs

The Snowflake SDK writes its log to `snowflake-logs/snowflake.log`. This folder is git-ignored.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `Error: Connection failed` | Wrong account identifier or credentials in `.env` |
| A database shows 0 tables/views | The configured role lacks `USAGE` on that database or schema |
| Missing databases in output | Check the **Errors** tab in the Excel file or `manifest.json` → `errors` |
