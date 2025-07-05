/*
  # Create favorites table

  1. New Tables
    - `favorites`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles.user_id)
      - `document_id` (uuid, references documents.id)
      - `created_at` (timestamp)
      - Unique constraint on user_id + document_id to prevent duplicate favorites

  2. Security
    - Enable RLS on `favorites` table
    - Add policy for authenticated users to manage their own favorites
    - Add policy for authenticated users to read their own favorites

  3. Indexes
    - Index on user_id for efficient user favorite queries
    - Index on document_id for efficient document favorite queries
    - Composite index on user_id + document_id for favorite checks
*/

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, document_id)
);

-- Add foreign key constraints
ALTER TABLE favorites 
ADD CONSTRAINT fk_favorites_user_id 
FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

ALTER TABLE favorites 
ADD CONSTRAINT fk_favorites_document_id 
FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_document_id ON favorites(document_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_document ON favorites(user_id, document_id);

-- Enable Row Level Security
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can insert own favorites"
  ON favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own favorites"
  ON favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);