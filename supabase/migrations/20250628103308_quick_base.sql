/*
  # Add User Profiles with Username System

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `username` (text, unique)
      - `display_name` (text)
      - `bio` (text)
      - `avatar_url` (text)
      - `last_username_change` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_profiles` table
    - Add policies for users to manage their own profiles
    - Add policy for public read access to profiles

  3. Functions
    - Add trigger to auto-create profile on user signup
    - Add function to generate unique usernames
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  display_name text,
  bio text DEFAULT '',
  avatar_url text,
  last_username_change timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create function to generate unique username
CREATE OR REPLACE FUNCTION generate_unique_username(base_name text DEFAULT 'user')
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_username text;
  counter integer := 1;
BEGIN
  -- Start with base name
  new_username := lower(regexp_replace(base_name, '[^a-zA-Z0-9]', '', 'g'));
  
  -- If empty, use 'user'
  IF new_username = '' THEN
    new_username := 'user';
  END IF;
  
  -- Check if username exists, if so add numbers
  WHILE EXISTS (SELECT 1 FROM user_profiles WHERE username = new_username) LOOP
    new_username := lower(regexp_replace(base_name, '[^a-zA-Z0-9]', '', 'g')) || counter::text;
    counter := counter + 1;
  END LOOP;
  
  RETURN new_username;
END;
$$;

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_username text;
  new_username text;
BEGIN
  -- Extract username from email (part before @)
  base_username := split_part(NEW.email, '@', 1);
  
  -- Generate unique username
  new_username := generate_unique_username(base_username);
  
  -- Insert profile
  INSERT INTO user_profiles (user_id, username, display_name)
  VALUES (NEW.id, new_username, base_username);
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-profile creation
DROP TRIGGER IF EXISTS create_profile_on_signup ON auth.users;
CREATE TRIGGER create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- Add index for username lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);