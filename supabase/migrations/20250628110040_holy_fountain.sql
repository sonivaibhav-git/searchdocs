/*
  # Create user profile trigger for new user signups

  1. New Functions
    - `handle_new_user()` - Creates a user profile entry when a new user signs up
  
  2. New Triggers
    - `on_auth_user_created` - Automatically triggers profile creation after user signup
  
  3. Security
    - Function runs with SECURITY DEFINER to ensure proper permissions
    - Generates unique usernames and sets initial display name
*/

-- Create a function to handle new user sign-ups by creating a profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, username, display_name, created_at, last_username_change)
  VALUES (
    NEW.id,
    'user_' || replace(NEW.id::text, '-', ''), -- Generates a unique initial username
    NEW.email, -- Initial display name can be email
    now(),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger that calls the function after a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();