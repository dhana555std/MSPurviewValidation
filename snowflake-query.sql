-- ============================================================
-- SNOWFLAKE ACCOUNT METADATA - CONSOLIDATED COUNTS
-- ============================================================
--
-- Returns one consolidated result containing:
--
--   1. Databases
--   2. Schemas
--   3. Tables
--   4. Columns
--   5. Views
--   6. Procedures
--   7. Notebooks
--
-- Objects are counted using Snowflake SHOW commands.
--
-- INFORMATION_SCHEMA schemas are excluded from the schema count.
--
-- ============================================================


-- ------------------------------------------------------------
-- Create temporary table for consolidated results
-- ------------------------------------------------------------

CREATE OR REPLACE TEMPORARY TABLE METADATA_COUNTS
(
    OBJECT_TYPE  VARCHAR,
    OBJECT_COUNT NUMBER
);


-- ============================================================
-- 1. DATABASES
-- ============================================================

SHOW DATABASES;

INSERT INTO METADATA_COUNTS
(
    OBJECT_TYPE,
    OBJECT_COUNT
)
SELECT
    'DATABASES',
    COUNT(*)
FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));


-- ============================================================
-- 2. SCHEMAS
-- ============================================================

SHOW SCHEMAS IN ACCOUNT;

INSERT INTO METADATA_COUNTS
(
    OBJECT_TYPE,
    OBJECT_COUNT
)
SELECT
    'SCHEMAS',
    COUNT(*)
FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))
WHERE UPPER("name") <> 'INFORMATION_SCHEMA';


-- ============================================================
-- 3. TABLES
-- ============================================================

SHOW TABLES IN ACCOUNT;

INSERT INTO METADATA_COUNTS
(
    OBJECT_TYPE,
    OBJECT_COUNT
)
SELECT
    'TABLES',
    COUNT(*)
FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));


-- ============================================================
-- 4. COLUMNS
-- ============================================================

SHOW COLUMNS IN ACCOUNT;

INSERT INTO METADATA_COUNTS
(
    OBJECT_TYPE,
    OBJECT_COUNT
)
SELECT
    'COLUMNS',
    COUNT(*)
FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));


-- ============================================================
-- 5. VIEWS
-- ============================================================

SHOW VIEWS IN ACCOUNT;

INSERT INTO METADATA_COUNTS
(
    OBJECT_TYPE,
    OBJECT_COUNT
)
SELECT
    'VIEWS',
    COUNT(*)
FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));


-- ============================================================
-- 6. PROCEDURES
-- ============================================================

SHOW PROCEDURES IN ACCOUNT;

INSERT INTO METADATA_COUNTS
(
    OBJECT_TYPE,
    OBJECT_COUNT
)
SELECT
    'PROCEDURES',
    COUNT(*)
FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));


-- ============================================================
-- 7. NOTEBOOKS
-- ============================================================

SHOW NOTEBOOKS IN ACCOUNT;

INSERT INTO METADATA_COUNTS
(
    OBJECT_TYPE,
    OBJECT_COUNT
)
SELECT
    'NOTEBOOKS',
    COUNT(*)
FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));


-- ============================================================
-- CONSOLIDATED RESULT
-- ============================================================

SELECT
    OBJECT_TYPE,
    OBJECT_COUNT
FROM METADATA_COUNTS
ORDER BY
    CASE OBJECT_TYPE
        WHEN 'DATABASES'   THEN 1
        WHEN 'SCHEMAS'     THEN 2
        WHEN 'TABLES'      THEN 3
        WHEN 'COLUMNS'     THEN 4
        WHEN 'VIEWS'       THEN 5
        WHEN 'PROCEDURES'  THEN 6
        WHEN 'NOTEBOOKS'   THEN 7
    END;
