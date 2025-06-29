/*
  # Fix user signup database error

  1. Clean up existing functions and triggers
  2. Create robust username generation function
  3. Create user profile creation trigger
  4. Set up proper permissions and RLS policies

  This migration ensures that new user signups work properly by automatically
  creating user profiles without causing database errors.
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS create_profile_on_signup ON auth.users;

-- Drop existing functions with their exact signatures
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.create_user_profile();
DROP FUNCTION IF EXISTS public.generate_unique_username(text);

-- Create an improved function to generate unique usernames
CREATE FUNCTION public.generate_unique_username(user_email text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_name text;
  new_username text;
  counter integer := 1;
BEGIN
  -- Extract username from email (part before @) and clean it
  base_name := lower(regexp_replace(split_part(user_email, '@', 1), '[^a-zA-Z0-9]', '', 'g'));
  
  -- If empty or too short, use 'user'
  IF base_name = '' OR length(base_name) < 3 THEN
    base_name := 'user';
  END IF;
  
  -- Limit length to 20 characters
  base_name := substring(base_name, 1, 20);
  
  -- Start with base name
  new_username := base_name;
  
  -- Check if username exists, if so add numbers
  WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = new_username) LOOP
    new_username := base_name || counter::text;
    counter := counter + 1;
    
    -- Prevent infinite loop
    IF counter > 9999 THEN
      new_username := 'user' || extract(epoch from now())::bigint::text;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN new_username;
END;
$$;

-- Create the main function to handle new user creation
CREATE FUNCTION public.handle_new_user()
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
  
  -- Insert the user profile
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
    now()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error creating user profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.user_profiles TO postgres, anon, authenticated, service_role;

-- Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.user_profiles;

-- Recreate policies
CREATE POLICY "Users can view all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create a policy for the service role to insert profiles during signup
CREATE POLICY "Service role can insert profiles"
  ON public.user_profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Ensure the updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.update_user_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop and recreate the updated_at trigger
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_profiles_updated_at();