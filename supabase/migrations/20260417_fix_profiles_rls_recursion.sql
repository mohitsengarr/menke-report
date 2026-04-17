-- SEN-214: Fix infinite recursion on the profiles table RLS policies.
--
-- Previous "Admins can view/update all profiles" policies referenced the
-- profiles table within their own USING clause, causing Postgres to
-- evaluate the policy recursively whenever a profile row was read or
-- updated. That recursion turned every authenticated-page render into a
-- hang on the server component that queries profiles. Downstream dashboard
-- page queries (valuation_projections, repurchase_obligations, etc.)
-- inherited the hang because they ran after the profile fetch in the
-- same render path.
--
-- Symptom: /dashboard, /valuation, /manage, /success-score, /formulas,
-- /report, /repurchase, /population/* were all stuck on the Suspense
-- loading skeleton indefinitely in production. Vercel runtime logs
-- reported HTTP 200. Postgres logs showed repeated
-- `infinite recursion detected in policy for relation "profiles"`.
--
-- Fix: introduce a SECURITY DEFINER helper `public.is_admin()` that
-- bypasses RLS when checking whether the caller is an admin, then rewrite
-- the admin policies to call it.
--
-- Applied via Supabase MCP `apply_migration` on 2026-04-17. Captured here
-- for git history and so any future database reset replays the fix.

-- Drop the recursive policies first
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Helper that checks whether the current auth.uid() corresponds to an
-- admin profile. Runs with the function owner's privileges (SECURITY
-- DEFINER) so it sidesteps the RLS policies that would otherwise recurse.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- Lock down the helper: only authenticated users can call it
REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Re-create the admin policies using the non-recursive helper
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
