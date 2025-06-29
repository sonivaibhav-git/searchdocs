/*
  # Fix user_profiles relationship and create missing profiles

  1. Data Integrity
    - Create missing user_profiles for existing documents
    - Generate usernames for users without profiles
    
  2. Database Structure
    - Add foreign key constraint between documents and user_profiles
    - Ensure referential integrity
    
  3. Security
    - Maintain existing RLS policies
    - Ensure proper data access controls
*/

-- First, create missing user_profiles for any users who have documents but no profile
INSERT INTO user_profiles (user_id, username, display_name, created_at, updated_at)
SELECT DISTINCT 
    d.user_id,
    'user_' || SUBSTRING(d.user_id::text, 1, 8) as username,
    'User ' || SUBSTRING(d.user_id::text, 1, 8) as display_name,
    NOW() as created_at,
    NOW() as updated_at
FROM documents d
LEFT JOIN user_profiles up ON d.user_id = up.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Also create profiles for any authenticated users who might not have profiles yet
-- This handles the case where users exist in auth.users but don't have profiles
INSERT INTO user_profiles (user_id, username, display_name, created_at, updated_at)
SELECT DISTINCT 
    au.id as user_id,
    'user_' || SUBSTRING(au.id::text, 1, 8) as username,
    COALESCE(au.email, 'User ' || SUBSTRING(au.id::text, 1, 8)) as display_name,
    NOW() as created_at,
    NOW() as updated_at
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Now add the foreign key constraint to establish relationship between documents and user_profiles
-- This allows Supabase to understand how to join these tables
ALTER TABLE documents 
ADD CONSTRAINT fk_documents_user_profiles 
FOREIGN KEY (user_id) 
REFERENCES user_profiles(user_id) 
ON DELETE CASCADE;