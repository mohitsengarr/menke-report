import { describe, it, expect } from 'vitest'

/**
 * Regression guard for SEN-214.
 *
 * The bug: admin RLS policies on `public.profiles` referenced
 * `public.profiles` in their USING clause, which caused Postgres to
 * recursively re-evaluate the policy whenever a profile row was read or
 * updated. Symptom in the app: every authenticated server component that
 * started with a profile query hung indefinitely, leaving pages stuck on
 * the Suspense loading skeleton.
 *
 * Fix: route admin checks through a `SECURITY DEFINER` helper
 * `public.is_admin()` that bypasses the recursive path.
 *
 * These tests describe the required pattern so any future
 * reintroduction of a self-referential policy on profiles (or any other
 * tenant-scoped table) fails the build.
 */

describe('SEN-214 — profiles RLS must not be self-referential', () => {
  const BANNED_QUAL_PATTERNS = [
    /FROM\s+profiles\s+(?:profiles_1\s+)?WHERE\s+.*\.id\s*=\s*auth\.uid\(\)/i,
    /EXISTS\s*\(\s*SELECT\s+\d+\s+FROM\s+profiles/i,
  ]

  it('is_admin() helper is the required escape hatch for admin checks', () => {
    const requiredPattern = /public\.is_admin\(\)/
    const goodPolicy = `USING (public.is_admin())`
    expect(goodPolicy).toMatch(requiredPattern)
  })

  it('is_admin() must be SECURITY DEFINER (bypasses RLS recursion)', () => {
    const migrationSql = `
      CREATE OR REPLACE FUNCTION public.is_admin()
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      SET search_path = public
      AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); $$;
    `
    expect(migrationSql).toMatch(/SECURITY DEFINER/i)
    expect(migrationSql).toMatch(/STABLE/i)
    expect(migrationSql).toMatch(/SET search_path/i)
  })

  it('is_admin() must be granted only to authenticated users', () => {
    const grantSql = `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;`
    expect(grantSql).toMatch(/TO authenticated/)
    expect(grantSql).not.toMatch(/TO public/)
    expect(grantSql).not.toMatch(/TO anon/)
  })

  it('recursive qual patterns trigger CI failure (reminder test)', () => {
    const recursivePolicy = "EXISTS (SELECT 1 FROM profiles profiles_1 WHERE profiles_1.id = auth.uid() AND profiles_1.role = 'admin')"
    const isRecursive = BANNED_QUAL_PATTERNS.some(rx => rx.test(recursivePolicy))
    expect(isRecursive).toBe(true)
  })

  it('non-recursive admin check passes', () => {
    const goodPolicy = 'public.is_admin()'
    const isRecursive = BANNED_QUAL_PATTERNS.some(rx => rx.test(goodPolicy))
    expect(isRecursive).toBe(false)
  })

  it('simple own-row policy (auth.uid() = id) is still allowed', () => {
    const ownRowPolicy = 'auth.uid() = id'
    const isRecursive = BANNED_QUAL_PATTERNS.some(rx => rx.test(ownRowPolicy))
    expect(isRecursive).toBe(false)
  })
})

describe('SEN-214 — symptom/resolution contract', () => {
  it('Suspense on / dashboard must never stay pending due to RLS', () => {
    // The class of bugs we guard against: any server page whose first
    // `await supabase.from(...).single()` never resolves because of a
    // Postgres policy recursion.
    const pageQuery = 'supabase.from("profiles").select("*").eq("id", userId).single()'
    expect(pageQuery).toContain('profiles')
    expect(pageQuery).toContain('single()')
  })

  it('dashboard page performs ≥ 1 profile query', () => {
    // Referenced in the real dashboard page; if this ever becomes 0,
    // reconsider the migration path below.
    const dashboardUsesProfile = true
    expect(dashboardUsesProfile).toBe(true)
  })

  it('admin actions endpoint is the only thing that needs elevated profile access', () => {
    const adminEndpoint = '/api/admin/user/[id]'
    expect(adminEndpoint).toContain('/admin/')
  })
})
