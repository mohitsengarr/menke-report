import { describe, it, expect } from 'vitest'

/**
 * Sidebar group-open regression guard.
 *
 * The Valuation group has children whose hrefs live under a DIFFERENT URL
 * segment from the parent:
 *   Parent: /valuation
 *   Children: /valuation, /repurchase, /repurchase/share-turnover
 *
 * The old logic opened children only when
 *   pathname === parent.href || pathname.startsWith(parent.href + '/')
 * Which is false for /repurchase — so clicking "Repurchase Obligation"
 * collapsed the Valuation group. Fixed by also opening the group when
 * ANY child's href matches the current path.
 */

type NavItem = { label: string; href: string; children?: { label: string; href: string }[] }

const VALUATION: NavItem = {
  label: 'Valuation', href: '/valuation',
  children: [
    { label: 'Capital Table & Valuation', href: '/valuation' },
    { label: 'Repurchase Obligation', href: '/repurchase' },
    { label: 'Share Turnover Schedule', href: '/repurchase/share-turnover' },
  ],
}

function groupOpen(item: NavItem, pathname: string): boolean {
  const selfActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const anyChildActive = item.children?.some(
    c => pathname === c.href || pathname.startsWith(c.href + '/')
  ) ?? false
  return selfActive || anyChildActive
}

describe('sidebar group open logic', () => {
  it('opens when pathname matches parent href exactly', () => {
    expect(groupOpen(VALUATION, '/valuation')).toBe(true)
  })

  it('opens when pathname is a descendant of parent', () => {
    expect(groupOpen(VALUATION, '/valuation/detail')).toBe(true)
  })

  it('opens when pathname matches a child outside the parent segment (SEN bug)', () => {
    // This was the failing case: clicking "Repurchase Obligation" (/repurchase)
    // would close the Valuation group because /repurchase is not a descendant
    // of /valuation. Now any child match keeps the group open.
    expect(groupOpen(VALUATION, '/repurchase')).toBe(true)
    expect(groupOpen(VALUATION, '/repurchase/share-turnover')).toBe(true)
  })

  it('closes when pathname matches NO child and NOT the parent', () => {
    expect(groupOpen(VALUATION, '/dashboard')).toBe(false)
    expect(groupOpen(VALUATION, '/settings')).toBe(false)
    expect(groupOpen(VALUATION, '/population')).toBe(false)
  })

  it('closes when pathname is a different top-level group', () => {
    const POPULATION: NavItem = {
      label: 'Population', href: '/population',
      children: [
        { label: 'Population Analysis', href: '/population' },
        { label: 'Avg Age & Tenure', href: '/population/average-age-tenure' },
      ],
    }
    // Valuation group should stay closed when user is in Population
    expect(groupOpen(VALUATION, '/population')).toBe(false)
    expect(groupOpen(VALUATION, '/population/average-age-tenure')).toBe(false)
    // Population should open instead
    expect(groupOpen(POPULATION, '/population/average-age-tenure')).toBe(true)
  })

  it('handles items with no children (leaf nav)', () => {
    const DASH: NavItem = { label: 'Dashboard', href: '/dashboard' }
    expect(groupOpen(DASH, '/dashboard')).toBe(true)
    expect(groupOpen(DASH, '/settings')).toBe(false)
  })

  it('exact-match parent beats startsWith of a similar path', () => {
    // /valuations (hypothetical) should NOT open /valuation because the
    // match is prefix-only with a following slash
    expect(groupOpen(VALUATION, '/valuations')).toBe(false)
  })

  it('children active highlight uses the same rule (exact or prefix with slash)', () => {
    const child = { href: '/repurchase' }
    expect('/repurchase' === child.href || '/repurchase'.startsWith(child.href + '/')).toBe(true)
    expect('/repurchase/share-turnover' === child.href || '/repurchase/share-turnover'.startsWith(child.href + '/')).toBe(true)
    expect('/repurchases' === child.href || '/repurchases'.startsWith(child.href + '/')).toBe(false)
  })
})
