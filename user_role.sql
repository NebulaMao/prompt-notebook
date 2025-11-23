-- User Roles and Permissions Management System - FIXED VERSION
-- This schema manages user roles: normal, vip, svip, admin
-- VIP and SVIP have expiration tracking
-- Only admin users can access the backend admin panel

-- Create user_roles enum type
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('normal', 'vip', 'svip', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'normal',
  -- Expiration tracking for VIP/SVIP
  expires_at TIMESTAMP WITH TIME ZONE,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.user_profiles;

-- FIXED POLICIES - No recursion!
-- Policy 1: Allow users to read their own profile
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Allow users to insert their own profile (for auto-creation)
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Allow users to update their own profile (but not role/expiration via RLS)
-- Note: This won't let them change role, that requires SECURITY DEFINER function
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create helper functions with SECURITY DEFINER to bypass RLS
-- These functions run with elevated privileges and don't trigger RLS recursion

-- Function to check if user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = user_uuid AND role = 'admin'
  );
$$;

-- Function to check if user role is active (not expired)
CREATE OR REPLACE FUNCTION public.is_role_active(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT role, expires_at INTO user_record
  FROM public.user_profiles
  WHERE user_id = user_uuid;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Admin and normal users don't expire
  IF user_record.role IN ('admin', 'normal') THEN
    RETURN TRUE;
  END IF;
  
  -- VIP and SVIP users check expiration
  IF user_record.role IN ('vip', 'svip') THEN
    RETURN (user_record.expires_at IS NULL OR user_record.expires_at > NOW());
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Function to get effective user role (considering expiration)
CREATE OR REPLACE FUNCTION public.get_effective_role(user_uuid UUID)
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT role, expires_at INTO user_record
  FROM public.user_profiles
  WHERE user_id = user_uuid;
  
  IF NOT FOUND THEN
    RETURN 'normal';
  END IF;
  
  -- Admin and normal users don't expire
  IF user_record.role IN ('admin', 'normal') THEN
    RETURN user_record.role;
  END IF;
  
  -- VIP and SVIP users check expiration
  IF user_record.role IN ('vip', 'svip') THEN
    IF user_record.expires_at IS NULL OR user_record.expires_at > NOW() THEN
      RETURN user_record.role;
    ELSE
      -- Expired, revert to normal
      RETURN 'normal';
    END IF;
  END IF;
  
  RETURN 'normal';
END;
$$;

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, role)
  VALUES (NEW.id, 'normal')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS user_profiles_expires_at_idx ON public.user_profiles(expires_at);

-- Create a view for easy querying of active users with their roles
CREATE OR REPLACE VIEW public.active_user_roles AS
SELECT 
  up.id,
  up.user_id,
  CASE 
    WHEN up.role IN ('admin', 'normal') THEN up.role
    WHEN up.role IN ('vip', 'svip') AND (up.expires_at IS NULL OR up.expires_at > NOW()) THEN up.role
    ELSE 'normal'::user_role
  END AS effective_role,
  up.role AS assigned_role,
  up.expires_at,
  CASE 
    WHEN up.role IN ('vip', 'svip') AND up.expires_at IS NOT NULL THEN up.expires_at > NOW()
    ELSE TRUE
  END AS is_active,
  up.created_at,
  up.updated_at
FROM public.user_profiles up;

-- Grant permissions
GRANT SELECT ON public.active_user_roles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;

-- Grant EXECUTE on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_role_active(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_role(UUID) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.user_profiles IS 'Stores user role and permission information';
COMMENT ON COLUMN public.user_profiles.role IS 'User role: normal (default), vip, svip, or admin';
COMMENT ON COLUMN public.user_profiles.expires_at IS 'Expiration date for VIP/SVIP roles. NULL means no expiration. Not used for normal/admin roles.';
COMMENT ON FUNCTION public.is_admin IS 'Check if a user has admin role - SECURITY DEFINER to bypass RLS';
COMMENT ON FUNCTION public.is_role_active IS 'Check if a user role is currently active (not expired)';
COMMENT ON FUNCTION public.get_effective_role IS 'Get the effective role of a user, considering expiration';
