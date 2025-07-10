/*
  # Document Management System with Folder Functionality

  1. New Tables
    - `folders`
      - `folder_id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles.user_id)
      - `folder_name` (varchar(50), folder name)
      - `parent_folder_id` (uuid, self-reference for hierarchy)
      - `folder_path` (text, materialized path for efficient queries)
      - `level` (integer, depth level for hierarchy validation)
      - `document_count` (integer, cached count for performance)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `is_deleted` (boolean, soft delete)

  2. Documents Table Modifications
    - Add `folder_id` column (nullable for root documents)
    - Add indexes for performance optimization

  3. Security
    - Enable RLS on folders table
    - Add policies for folder management
    - Maintain document security with folder context

  4. Performance Optimizations
    - Materialized path for efficient hierarchy queries
    - Cached document counts
    - Optimized indexes
    - Triggers for maintaining data consistency
*/

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  folder_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  folder_name varchar(50) NOT NULL,
  parent_folder_id uuid REFERENCES folders(folder_id) ON DELETE CASCADE,
  folder_path text NOT NULL DEFAULT '',
  level integer NOT NULL DEFAULT 0,
  document_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_deleted boolean DEFAULT false,
  
  -- Constraints
  CONSTRAINT folder_name_length CHECK (length(trim(folder_name)) >= 3 AND length(trim(folder_name)) <= 50),
  CONSTRAINT folder_name_format CHECK (folder_name ~ '^[a-zA-Z0-9\s\-_\.]+$'),
  CONSTRAINT max_hierarchy_level CHECK (level <= 5),
  CONSTRAINT max_documents_per_folder CHECK (document_count <= 1000)
);

-- Add foreign key to user_profiles
ALTER TABLE folders 
ADD CONSTRAINT fk_folders_user_id 
FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

-- Add folder_id to documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN folder_id uuid REFERENCES folders(folder_id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_folder_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders USING gin(folder_path gin_trgm_ops) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_folders_level ON folders(level) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_documents_folder_user ON documents(folder_id, user_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id) WHERE folder_id IS NOT NULL;

-- Enable RLS on folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for folders
CREATE POLICY "Users can view own folders"
  ON folders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_deleted = false);

CREATE POLICY "Users can insert own folders"
  ON folders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own folders"
  ON folders
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own folders"
  ON folders
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to update folder path and level
CREATE OR REPLACE FUNCTION update_folder_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  parent_path text := '';
  parent_level integer := 0;
BEGIN
  -- Get parent folder info if exists
  IF NEW.parent_folder_id IS NOT NULL THEN
    SELECT folder_path, level INTO parent_path, parent_level
    FROM folders 
    WHERE folder_id = NEW.parent_folder_id;
    
    -- Check hierarchy level limit
    IF parent_level >= 5 THEN
      RAISE EXCEPTION 'Maximum folder hierarchy level (5) exceeded';
    END IF;
    
    NEW.level := parent_level + 1;
    NEW.folder_path := parent_path || '/' || NEW.folder_id::text;
  ELSE
    NEW.level := 0;
    NEW.folder_path := '/' || NEW.folder_id::text;
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for folder hierarchy
CREATE TRIGGER trigger_update_folder_hierarchy
  BEFORE INSERT OR UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_folder_hierarchy();

-- Function to update document counts
CREATE OR REPLACE FUNCTION update_folder_document_count()
RETURNS TRIGGER AS $$
DECLARE
  old_folder_id uuid;
  new_folder_id uuid;
BEGIN
  -- Handle different trigger events
  IF TG_OP = 'INSERT' THEN
    new_folder_id := NEW.folder_id;
  ELSIF TG_OP = 'DELETE' THEN
    old_folder_id := OLD.folder_id;
  ELSIF TG_OP = 'UPDATE' THEN
    old_folder_id := OLD.folder_id;
    new_folder_id := NEW.folder_id;
  END IF;
  
  -- Update old folder count
  IF old_folder_id IS NOT NULL THEN
    UPDATE folders 
    SET document_count = (
      SELECT COUNT(*) 
      FROM documents 
      WHERE folder_id = old_folder_id
    )
    WHERE folder_id = old_folder_id;
  END IF;
  
  -- Update new folder count
  IF new_folder_id IS NOT NULL THEN
    UPDATE folders 
    SET document_count = (
      SELECT COUNT(*) 
      FROM documents 
      WHERE folder_id = new_folder_id
    )
    WHERE folder_id = new_folder_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for document count updates
CREATE TRIGGER trigger_document_folder_count_insert
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_folder_document_count();

CREATE TRIGGER trigger_document_folder_count_update
  AFTER UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_folder_document_count();

CREATE TRIGGER trigger_document_folder_count_delete
  AFTER DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_folder_document_count();

-- Function to check if folder can be deleted (empty only)
CREATE OR REPLACE FUNCTION can_delete_folder(folder_uuid uuid)
RETURNS boolean AS $$
DECLARE
  doc_count integer;
  subfolder_count integer;
BEGIN
  -- Check for documents in folder
  SELECT COUNT(*) INTO doc_count
  FROM documents
  WHERE folder_id = folder_uuid;
  
  -- Check for subfolders
  SELECT COUNT(*) INTO subfolder_count
  FROM folders
  WHERE parent_folder_id = folder_uuid AND is_deleted = false;
  
  RETURN (doc_count = 0 AND subfolder_count = 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get folder tree for a user
CREATE OR REPLACE FUNCTION get_folder_tree(user_uuid uuid)
RETURNS TABLE(
  folder_id uuid,
  folder_name varchar(50),
  parent_folder_id uuid,
  level integer,
  document_count integer,
  created_at timestamptz,
  has_children boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE folder_tree AS (
    -- Root folders
    SELECT 
      f.folder_id,
      f.folder_name,
      f.parent_folder_id,
      f.level,
      f.document_count,
      f.created_at,
      EXISTS(
        SELECT 1 FROM folders cf 
        WHERE cf.parent_folder_id = f.folder_id 
        AND cf.is_deleted = false
      ) as has_children
    FROM folders f
    WHERE f.user_id = user_uuid 
    AND f.parent_folder_id IS NULL 
    AND f.is_deleted = false
    
    UNION ALL
    
    -- Child folders
    SELECT 
      f.folder_id,
      f.folder_name,
      f.parent_folder_id,
      f.level,
      f.document_count,
      f.created_at,
      EXISTS(
        SELECT 1 FROM folders cf 
        WHERE cf.parent_folder_id = f.folder_id 
        AND cf.is_deleted = false
      ) as has_children
    FROM folders f
    INNER JOIN folder_tree ft ON f.parent_folder_id = ft.folder_id
    WHERE f.user_id = user_uuid 
    AND f.is_deleted = false
  )
  SELECT * FROM folder_tree
  ORDER BY level, folder_name;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_folder_tree(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_delete_folder(uuid) TO authenticated;