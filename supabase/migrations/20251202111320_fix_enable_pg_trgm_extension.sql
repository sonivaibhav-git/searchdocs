/*
  # Enable pg_trgm Extension for Text Search

  1. Extensions
    - Enable `pg_trgm` extension for trigram text similarity and GIN indexing
    - This extension provides the `gin_trgm_ops` operator class needed for text search indexes

  2. Index Fix
    - Drop and recreate the folders path index if the folders table exists
    - This enables efficient pattern matching and similarity searches on folder paths

  Important Notes:
    - The `pg_trgm` extension must be enabled before creating GIN indexes with `gin_trgm_ops`
    - This extension is required for advanced text search features like similarity matching
    - The extension is safe to enable and commonly used in production databases
    - This migration is idempotent and safe to run multiple times
*/

-- Enable pg_trgm extension for trigram text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fix the folders table index if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'folders' AND table_schema = 'public'
  ) THEN
    -- Drop the existing problematic index if it exists
    DROP INDEX IF EXISTS idx_folders_path;
    
    -- Recreate the index with the proper extension now available
    CREATE INDEX IF NOT EXISTS idx_folders_path 
      ON folders 
      USING gin(folder_path gin_trgm_ops) 
      WHERE is_deleted = false;
  END IF;
END $$;
