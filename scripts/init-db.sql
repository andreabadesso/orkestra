-- =============================================================================
-- Orkestra Development Database Initialization
-- =============================================================================
-- This script runs automatically when the PostgreSQL container starts for the
-- first time. It sets up the necessary databases and extensions.
--
-- Note: The default database (orkestra_dev) is created by Docker via the
-- POSTGRES_DB environment variable. This script creates additional databases
-- needed for Temporal.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
-- Enable useful PostgreSQL extensions in the main database

-- UUID generation (useful for primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Better text search capabilities
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -----------------------------------------------------------------------------
-- Temporal Databases
-- -----------------------------------------------------------------------------
-- Temporal requires two databases for its persistence layer:
-- 1. temporal - Main workflow and activity data
-- 2. temporal_visibility - Search and visibility features

-- Create Temporal main database
SELECT 'CREATE DATABASE temporal'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'temporal')\gexec

-- Create Temporal visibility database
SELECT 'CREATE DATABASE temporal_visibility'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'temporal_visibility')\gexec

-- -----------------------------------------------------------------------------
-- Grant Permissions
-- -----------------------------------------------------------------------------
-- Ensure the orkestra user has full access to Temporal databases

GRANT ALL PRIVILEGES ON DATABASE temporal TO orkestra;
GRANT ALL PRIVILEGES ON DATABASE temporal_visibility TO orkestra;

-- -----------------------------------------------------------------------------
-- Application Schema Setup
-- -----------------------------------------------------------------------------
-- Create schemas for organizing application data
-- The actual tables will be created by Prisma migrations

CREATE SCHEMA IF NOT EXISTS orkestra;

-- Grant permissions on the schema
GRANT ALL ON SCHEMA orkestra TO orkestra;
GRANT ALL ON ALL TABLES IN SCHEMA orkestra TO orkestra;
GRANT ALL ON ALL SEQUENCES IN SCHEMA orkestra TO orkestra;

-- Set default search path to include our schema
ALTER DATABASE orkestra_dev SET search_path TO public, orkestra;

-- -----------------------------------------------------------------------------
-- Development Helpers
-- -----------------------------------------------------------------------------
-- Create a function to reset the development database (useful for testing)

CREATE OR REPLACE FUNCTION reset_orkestra_schema()
RETURNS void AS $$
BEGIN
    -- Drop and recreate the orkestra schema
    DROP SCHEMA IF EXISTS orkestra CASCADE;
    CREATE SCHEMA orkestra;
    GRANT ALL ON SCHEMA orkestra TO orkestra;

    RAISE NOTICE 'Orkestra schema has been reset';
END;
$$ LANGUAGE plpgsql;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Orkestra database initialization complete!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Databases created:';
    RAISE NOTICE '  - orkestra_dev (main application)';
    RAISE NOTICE '  - temporal (workflow engine)';
    RAISE NOTICE '  - temporal_visibility (search)';
    RAISE NOTICE '===========================================';
END $$;
