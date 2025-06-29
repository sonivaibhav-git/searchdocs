/*
  # Username editing restrictions

  1. Database Changes
    - Add function to check if username can be edited
    - Update user profile policies to enforce username editing rules
    - Ensure last_username_change is properly tracked

  2. Business Rules
    - Username can be edited on the day of account creation
    - After first edit, must wait 15 days before next edit
    - Username must be unique and follow validation rules

  3. Security
    - Maintain existing RLS policies
    - Add validation for username format
*/

-- Create function to check if username can be edited
CREATE OR REPLACE FUNCTION public.can_edit_username(profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record user_profiles;
  days_since_last_change numeric;
  account_creation_date date;
  last_change_date date;
  current_date_val date;
BEGIN
  -- Get the user profile
  SELECT * INTO profile_record
  FROM user_profiles
  WHERE user_id = profile_user_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get dates for comparison
  current_date_val := CURRENT_DATE;
  account_creation_date := profile_record.created_at::date;
  last_change_date := profile_record.last_username_change::date;
  
  -- If it's the same day as account creation, allow editing
  IF current_date_val = account_creation_date THEN
    RETURN true;
  END IF;
  
  -- Calculate days since last username change
  days_since_last_change := EXTRACT(EPOCH FROM (current_date_val - last_change_date)) / 86400;
  
  -- Allow editing if 15 or more days have passed
  RETURN days_since_last_change >= 15;
END;
$$;

-- Create function to validate username format
CREATE OR REPLACE FUNCTION public.validate_username(new_username text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if username is not empty
  IF new_username IS NULL OR trim(new_username) = '' THEN
    RETURN false;
  END IF;
  
  -- Check length (3-30 characters)
  IF length(trim(new_username)) < 3 OR length(trim(new_username)) > 30 THEN
    RETURN false;
  END IF;
  
  -- Check format: only letters, numbers, and underscores
  IF NOT (trim(new_username) ~ '^[a-zA-Z0-9_]+$') THEN
    RETURN false;
  END IF;
  
  -- Must start with a letter or number (not underscore)
  IF NOT (trim(new_username) ~ '^[a-zA-Z0-9]') THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Update the user profiles table to add a constraint for username validation
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS username_format_check;

ALTER TABLE user_profiles 
ADD CONSTRAINT username_format_check 
CHECK (validate_username(username));

-- Create a function to handle username updates with restrictions
CREATE OR REPLACE FUNCTION public.update_username_with_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If username is being changed
  IF OLD.username != NEW.username THEN
    -- Check if user can edit username
    IF NOT public.can_edit_username(NEW.user_id) THEN
      RAISE EXCEPTION 'Username can only be changed on the day of account creation or after 15 days from the last change';
    END IF;
    
    -- Validate new username format
    IF NOT public.validate_username(NEW.username) THEN
      RAISE EXCEPTION 'Username must be 3-30 characters long, contain only letters, numbers, and underscores, and start with a letter or number';
    END IF;
    
    -- Check if username is already taken
    IF EXISTS (SELECT 1 FROM user_profiles WHERE username = NEW.username AND user_id != NEW.user_id) THEN
      RAISE EXCEPTION 'Username is already taken';
    END IF;
    
    -- Update the last_username_change timestamp
    NEW.last_username_change = now();
  END IF;
  
  -- Always update the updated_at timestamp
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Drop existing update trigger and create new one with username restrictions
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
DROP TRIGGER IF EXISTS username_update_restrictions ON public.user_profiles;

CREATE TRIGGER username_update_restrictions
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_username_with_restrictions();

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION public.can_edit_username(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_username(text) TO authenticated;

-- Update the handle_new_user function to set proper initial timestamps
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_username text;
  display_name text;
BEGIN
  -- Generate unique username
  new_username := public.generate_unique_username(NEW.email);
  
  -- Set display name (use part before @ from email)
  display_name := split_part(NEW.email, '@', 1);
  
  -- Insert the user profile with creation timestamp
  INSERT INTO public.user_profiles (
    user_id,
    username,
    display_name,
    bio,
    created_at,
    updated_at,
    last_username_change
  ) VALUES (
    NEW.id,
    new_username,
    display_name,
    '',
    now(),
    now(),
    now() -- Set initial last_username_change to account creation time
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error creating user profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;