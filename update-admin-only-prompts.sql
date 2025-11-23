-- ============================================================
-- Migration: Change Prompts to Admin-Only Management
-- Description: Only admin users can create/update/delete prompts
--              All users can still read prompts
-- Run this in Supabase SQL Editor to update your database
-- ============================================================

-- Drop all existing policies on prompts table
DROP POLICY IF EXISTS "Anyone can read prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can insert their own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can update their own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can delete their own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Only admins can insert prompts" ON public.prompts;
DROP POLICY IF EXISTS "Only admins can update prompts" ON public.prompts;
DROP POLICY IF EXISTS "Only admins can delete prompts" ON public.prompts;

-- Policy 1: Anyone can read prompts (public access)
CREATE POLICY "Anyone can read prompts"
  ON public.prompts
  FOR SELECT
  USING (true);

-- Policy 2: Only admins can insert prompts
CREATE POLICY "Only admins can insert prompts"
  ON public.prompts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy 3: Only admins can update prompts
CREATE POLICY "Only admins can update prompts"
  ON public.prompts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy 4: Only admins can delete prompts
CREATE POLICY "Only admins can delete prompts"
  ON public.prompts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Display current policies (for verification)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'prompts'
ORDER BY policyname;
