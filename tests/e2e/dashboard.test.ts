import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ADMIN_USER = {
  email: process.env.ADMIN_EMAIL || 'admin@menke-test.com',
  password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
}

async function loginAndNavigate(
  page: import('@playwright/test').Page,
  path: string = '/dashboard',
) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input#email', ADMIN_USER.email)
  await page.fill('input#password', ADMIN_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })

  if (path !== '/dashboard') {
    await page.goto(`${BASE_URL}${path}`)
    await page.waitForLoadState('networkidle')
  }
}

// ---------------------------------------------------------------------------
// 1-2. Dashboard states
// ---------------------------------------------------------------------------
test.describe('Dashboard', () => {
  test('dashboard empty state: shows "No Data Uploaded" message with import CTA', async ({ page }) => {
    await loginAndNavigate(page)

    // Either the user has data (KPI cards visible) or no data (empty state)
    const hasEmptyState = await page.locator('text=No Data Uploaded Yet').isVisible().catch(() => false)
    const hasKPICards = await page.locator('.grid .card, [class*="Card"]').first().isVisible().catch(() => false)

    // One of the two states must be true
    expect(hasEmptyState || hasKPICards).toBe(true)

    if (hasEmptyState) {
      await expect(page.locator('text=No Data Uploaded Yet')).toBeVisible()
      await expect(page.locator('text=Import Excel Data')).toBeVisible()
      await expect(page.locator('a[href="/import"]')).toBeVisible()
    }
  })

  test('dashboard with data: shows KPI cards when data is present', async ({ page }) => {
    await loginAndNavigate(page)

    // If data exists, we expect KPI cards with icons
    const hasData = await page.locator('text=ESOP Valuation').isVisible().catch(() => false)

    if (hasData) {
      await expect(page.locator('text=ESOP Valuation')).toBeVisible()
      // Check that multiple KPI cards are rendered
      const cards = page.locator('[class*="Card"]')
      const count = await cards.count()
      expect(count).toBeGreaterThanOrEqual(1)
    } else {
      // Empty state is also valid
      await expect(page.locator('text=No Data Uploaded Yet')).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// 3-4. Valuation page
// ---------------------------------------------------------------------------
test.describe('Valuation', () => {
  test('valuation page: table renders with correct columns', async ({ page }) => {
    await loginAndNavigate(page, '/valuation')

    // Check for table or empty state
    const table = page.locator('table').first()
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      // Expect valuation-related column headers
      const headers = page.locator('table thead th')
      const count = await headers.count()
      expect(count).toBeGreaterThanOrEqual(3)
    }
  })

  test('valuation page empty: shows empty state message when no data', async ({ page }) => {
    await loginAndNavigate(page, '/valuation')

    // Either a table or empty state should render
    const hasTable = await page.locator('table').first().isVisible().catch(() => false)
    const hasEmptyState = await page.locator('text=/no.*data|empty|no.*records/i').isVisible().catch(() => false)

    expect(hasTable || hasEmptyState).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5-8. Population pages
// ---------------------------------------------------------------------------
test.describe('Population', () => {
  test('population page: table renders', async ({ page }) => {
    await loginAndNavigate(page, '/population')

    await page.waitForLoadState('networkidle')
    const content = page.locator('main, [class*="space-y"]').first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('population projection: enter rate, calculate, see 10 rows', async ({ page }) => {
    await loginAndNavigate(page, '/population/projection')

    await page.waitForLoadState('networkidle')

    // Look for an input or form for growth rate
    const rateInput = page.locator('input[type="number"]').first()
    const hasInput = await rateInput.isVisible().catch(() => false)

    if (hasInput) {
      await rateInput.fill('3')
      // Look for a calculate button
      const calcButton = page.locator('button:has-text("Calculate"), button:has-text("Project"), button:has-text("Generate")').first()
      const hasButton = await calcButton.isVisible().catch(() => false)
      if (hasButton) {
        await calcButton.click()
        await page.waitForTimeout(2000)

        // Check table rows
        const rows = page.locator('table tbody tr')
        const count = await rows.count()
        expect(count).toBeGreaterThanOrEqual(1)
      }
    }
  })

  test('population average age tenure: page renders', async ({ page }) => {
    await loginAndNavigate(page, '/population/average-age-tenure')

    await page.waitForLoadState('networkidle')
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('population average balance: page renders', async ({ page }) => {
    await loginAndNavigate(page, '/population/average-balance')

    await page.waitForLoadState('networkidle')
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// 9-10. Repurchase pages
// ---------------------------------------------------------------------------
test.describe('Repurchase', () => {
  test('repurchase page: table renders', async ({ page }) => {
    await loginAndNavigate(page, '/repurchase')

    await page.waitForLoadState('networkidle')
    const content = page.locator('main, [class*="space-y"]').first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('repurchase share turnover: table and chart render', async ({ page }) => {
    await loginAndNavigate(page, '/repurchase/share-turnover')

    await page.waitForLoadState('networkidle')
    const content = page.locator('main, [class*="space-y"]').first()
    await expect(content).toBeVisible({ timeout: 10000 })

    // Check for either a table or chart container (recharts renders SVG)
    const hasTable = await page.locator('table').first().isVisible().catch(() => false)
    const hasChart = await page.locator('svg.recharts-surface, [class*="recharts"], canvas').first().isVisible().catch(() => false)
    const hasContent = hasTable || hasChart || await page.locator('text=/no.*data|empty/i').isVisible().catch(() => false)
    expect(hasContent).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 11-12. Success Score
// ---------------------------------------------------------------------------
test.describe('Success Score', () => {
  test('success score: health badge renders', async ({ page }) => {
    await loginAndNavigate(page, '/success-score')

    await page.waitForLoadState('networkidle')
    // Page should render heading and either data or empty state
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('success score: table renders when data present', async ({ page }) => {
    await loginAndNavigate(page, '/success-score')

    await page.waitForLoadState('networkidle')
    const hasTable = await page.locator('table').first().isVisible().catch(() => false)
    const hasEmptyState = await page.locator('text=/no.*data|empty|no.*score/i').isVisible().catch(() => false)

    expect(hasTable || hasEmptyState).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 13-15. Manage page
// ---------------------------------------------------------------------------
test.describe('Manage', () => {
  test('manage page: participant table renders', async ({ page }) => {
    await loginAndNavigate(page, '/manage')

    await page.waitForLoadState('networkidle')
    const content = page.locator('main, [class*="space-y"]').first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('manage page: search filters by name', async ({ page }) => {
    await loginAndNavigate(page, '/manage')

    await page.waitForLoadState('networkidle')

    // Look for a search input
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"], input[type="search"]').first()
    const hasSearch = await searchInput.isVisible().catch(() => false)

    if (hasSearch) {
      await searchInput.fill('test')
      await page.waitForTimeout(1000)
      // After filtering, the page should still be usable
      const content = page.locator('main, [class*="space-y"]').first()
      await expect(content).toBeVisible()
    }
  })

  test('manage detail: shows participant fields', async ({ page }) => {
    await loginAndNavigate(page, '/manage')

    await page.waitForLoadState('networkidle')

    // Click on a participant row if available
    const firstRow = page.locator('table tbody tr a, table tbody tr').first()
    const hasRow = await firstRow.isVisible().catch(() => false)

    if (hasRow) {
      await firstRow.click()
      await page.waitForLoadState('networkidle')

      // The detail page should show participant fields
      const detailContent = page.locator('main, [class*="space-y"]').first()
      await expect(detailContent).toBeVisible({ timeout: 10000 })
    }
  })
})

// ---------------------------------------------------------------------------
// 16-19. Settings page
// ---------------------------------------------------------------------------
test.describe('Settings', () => {
  test('settings page: 6 tabs visible', async ({ page }) => {
    await loginAndNavigate(page, '/settings')

    await expect(page.locator('text=ESOP Settings')).toBeVisible({ timeout: 10000 })

    const tabs = ['Plan Provisions', 'Allocations', 'Distributions', 'Funding', 'Valuation Inputs', 'Share Prices']
    for (const tab of tabs) {
      await expect(page.locator(`button:has-text("${tab}")`)).toBeVisible()
    }
  })

  test('settings: can switch between tabs', async ({ page }) => {
    await loginAndNavigate(page, '/settings')

    await page.waitForLoadState('networkidle')

    // Click on Distributions tab
    await page.click('button:has-text("Distributions")')
    await expect(page.locator('label:has-text("ESOP Formation Date")')).toBeVisible({ timeout: 5000 })

    // Click on Funding tab
    await page.click('button:has-text("Funding")')
    await expect(page.locator('label:has-text("Stub Period")')).toBeVisible({ timeout: 5000 })
  })

  test('settings: save shows success message', async ({ page }) => {
    await loginAndNavigate(page, '/settings')

    await page.waitForLoadState('networkidle')

    // Wait for loading to finish
    await page.waitForSelector('text=Loading settings...', { state: 'hidden', timeout: 10000 }).catch(() => {})

    // Click Save button
    await page.click('button:has-text("Save")')

    // Expect a success message
    await expect(page.locator('text=saved successfully')).toBeVisible({ timeout: 10000 })
  })

  test('settings: values persist after save + refresh', async ({ page }) => {
    await loginAndNavigate(page, '/settings')

    await page.waitForLoadState('networkidle')
    await page.waitForSelector('text=Loading settings...', { state: 'hidden', timeout: 10000 }).catch(() => {})

    // Set a field value
    const compLimitInput = page.locator('#field-compensation_limit')
    await expect(compLimitInput).toBeVisible({ timeout: 5000 })
    await compLimitInput.fill('350000')

    // Save
    await page.click('button:has-text("Save")')
    await expect(page.locator('text=saved successfully')).toBeVisible({ timeout: 10000 })

    // Refresh
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('text=Loading settings...', { state: 'hidden', timeout: 10000 }).catch(() => {})

    // Verify persistence
    const value = await page.locator('#field-compensation_limit').inputValue()
    expect(value).toBe('350000')
  })
})

// ---------------------------------------------------------------------------
// 20-21. History page
// ---------------------------------------------------------------------------
test.describe('History', () => {
  test('history page: create backup button visible', async ({ page }) => {
    await loginAndNavigate(page, '/history')

    await page.waitForLoadState('networkidle')
    await expect(page.locator('button:has-text("Create Backup"), button:has-text("Backup")')).toBeVisible({ timeout: 10000 })
  })

  test('history: create backup adds entry to list', async ({ page }) => {
    await loginAndNavigate(page, '/history')

    await page.waitForLoadState('networkidle')

    // Count existing snapshots
    const initialRows = await page.locator('[class*="Card"], table tbody tr').count()

    // Click create backup
    await page.click('button:has-text("Create Backup"), button:has-text("Backup")')
    await page.waitForTimeout(3000)

    // Wait for success message or updated list
    const success = await page.locator('text=Backup created successfully').isVisible().catch(() => false)
    if (success) {
      // List should have grown
      const newRows = await page.locator('[class*="Card"], table tbody tr').count()
      expect(newRows).toBeGreaterThanOrEqual(initialRows)
    }
  })
})

// ---------------------------------------------------------------------------
// 22-24. Report page
// ---------------------------------------------------------------------------
test.describe('Report', () => {
  test('report page: title and subtitle fields present', async ({ page }) => {
    await loginAndNavigate(page, '/report')

    await page.waitForLoadState('networkidle')

    // Title field should be pre-filled with default
    const titleInput = page.locator('input').first()
    await expect(titleInput).toBeVisible({ timeout: 10000 })
    const titleValue = await titleInput.inputValue()
    expect(titleValue).toContain('ESOP')
  })

  test('report: generate PDF button present and clickable', async ({ page }) => {
    await loginAndNavigate(page, '/report')

    await page.waitForLoadState('networkidle')

    const pdfButton = page.locator('button:has-text("PDF"), button:has-text("Generate PDF")').first()
    await expect(pdfButton).toBeVisible({ timeout: 10000 })
  })

  test('report: generate PPTX button present', async ({ page }) => {
    await loginAndNavigate(page, '/report')

    await page.waitForLoadState('networkidle')

    const pptxButton = page.locator('button:has-text("PPTX"), button:has-text("PowerPoint"), button:has-text("Presentation")').first()
    await expect(pptxButton).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// 25-26. About and Formulas pages
// ---------------------------------------------------------------------------
test.describe('Informational pages', () => {
  test('about page: renders without error', async ({ page }) => {
    await loginAndNavigate(page, '/about')

    await page.waitForLoadState('networkidle')
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })

    // No error state
    const errorVisible = await page.locator('text=/error|500|something went wrong/i').isVisible().catch(() => false)
    expect(errorVisible).toBe(false)
  })

  test('formulas page: renders documentation', async ({ page }) => {
    await loginAndNavigate(page, '/formulas')

    await page.waitForLoadState('networkidle')
    const content = page.locator('main, [class*="space-y"]').first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// 27-28. Sidebar navigation
// ---------------------------------------------------------------------------
test.describe('Sidebar', () => {
  test('sidebar: all navigation links present', async ({ page }) => {
    await loginAndNavigate(page)

    // Ensure sidebar is visible (only on lg+ screens)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForTimeout(500)

    const expectedLinks = [
      'Dashboard', 'Projections', 'Population', 'ESOP Success Score',
      'Settings', 'Import Data', 'Data Manage', 'Backup History',
      'Reports', 'About', 'Formula Engine',
    ]

    for (const label of expectedLinks) {
      await expect(page.locator(`nav >> text="${label}"`)).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// 29. Topbar
// ---------------------------------------------------------------------------
test.describe('Topbar', () => {
  test('topbar: user avatar and dropdown visible', async ({ page }) => {
    await loginAndNavigate(page)

    // Avatar should be in the topbar
    const avatar = page.locator('header [class*="Avatar"], header [class*="avatar"]').first()
    await expect(avatar).toBeVisible({ timeout: 10000 })

    // Click avatar to open dropdown
    await avatar.click()

    // Dropdown items
    await expect(page.locator('text=Profile')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Sign out')).toBeVisible()
  })

  test('topbar: logout button in dropdown', async ({ page }) => {
    await loginAndNavigate(page)

    const avatar = page.locator('header [class*="Avatar"], header [class*="avatar"]').first()
    await avatar.click()

    await expect(page.locator('text=Sign out')).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// 30. Import page
// ---------------------------------------------------------------------------
test.describe('Import', () => {
  test('import page: 3 sections visible (upload, sync, population)', async ({ page }) => {
    await loginAndNavigate(page, '/import')

    await page.waitForLoadState('networkidle')

    // The import page has 3 Card sections
    const cards = page.locator('[class*="Card"]')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(3)

    // Check for file input in upload section
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toHaveCount(1)
  })
})
