/*
  # Add Document Publishing and Tags Feature

  1. Schema Changes
    - Add `is_public` column to documents table (boolean, default false)
    - Add `tags` column to documents table (text array)
    - Update RLS policies to handle public documents
    - Add indexes for performance

  2. Security Updates
    - Update RLS policies to allow reading public documents from any user
    - Maintain privacy for private documents
    - Ensure users can only modify their own documents

  3. Performance
    - Add indexes for public documents and tags
    - Optimize search queries
*/

-- Add new columns to documents table
DO $$
BEGIN
  -- Add is_public column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE documents ADD COLUMN is_public boolean DEFAULT false NOT NULL;
  END IF;

  -- Add tags column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'tags'
  ) THEN
    ALTER TABLE documents ADD COLUMN tags text[] DEFAULT '{}' NOT NULL;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_is_public ON documents (is_public);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_documents_public_created_at ON documents (is_public, created_at DESC);

-- Update RLS policies to handle public documents
DROP POLICY IF EXISTS "Users can view own documents" ON documents;

-- Policy for viewing documents (own private + all public)
CREATE POLICY "Users can view own and public documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR is_public = true
  );

-- Keep existing policies for insert, update, delete (users can only modify their own)
-- These should already exist but let's ensure they're correct

DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
CREATE POLICY "Users can insert own documents"
  ON documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own documents" ON documents;
CREATE POLICY "Users can update own documents"
  ON documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
CREATE POLICY "Users can delete own documents"
  ON documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);