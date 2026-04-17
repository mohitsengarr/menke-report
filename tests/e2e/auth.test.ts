import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TEST_USER = {
  username: 'TestUser',
  email: `test-${Date.now()}@menke-test.com`,
  password: 'TestPassword123!',
}

const ADMIN_USER = {
  email: process.env.ADMIN_EMAIL || 'admin@menke-test.com',
  password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
}

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input#email', email)
  await page.fill('input#password', password)
  await page.click('button[type="submit"]')
}

// ---------------------------------------------------------------------------
// 1. Register flow
// ---------------------------------------------------------------------------
test.describe('Registration', () => {
  test('register flow: navigate to /register, fill form, submit, see success', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)

    await expect(page.locator('h1')).toContainText('MENKE')
    await expect(page.locator('text=Create an account')).toBeVisible()

    await page.fill('input#username', TEST_USER.username)
    await page.fill('input#email', TEST_USER.email)
    await page.fill('input#password', TEST_USER.password)
    await page.click('button[type="submit"]')

    await expect(page.locator('text=Registration Successful')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Your account has been created')).toBeVisible()
    await expect(page.locator('text=Go to Login')).toBeVisible()
  })

  test('register with duplicate email: shows error', async ({ page }) => {
    // Use the admin email which is assumed to already exist
    await page.goto(`${BASE_URL}/register`)

    await page.fill('input#username', 'DuplicateUser')
    await page.fill('input#email', ADMIN_USER.email)
    await page.fill('input#password', 'SomePassword123!')
    await page.click('button[type="submit"]')

    // Supabase returns an error for duplicate signups
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 })
  })

  test('register with short password: validation blocks submission', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)

    await page.fill('input#username', 'ShortPwdUser')
    await page.fill('input#email', `shortpwd-${Date.now()}@menke-test.com`)
    await page.fill('input#password', 'abc')
    await page.click('button[type="submit"]')

    // The page validates minLength=6 — either browser validation blocks or app shows error
    await expect(page.locator('text=Password must be at least 6 characters')).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// 2. Login flow
// ---------------------------------------------------------------------------
test.describe('Login', () => {
  test('login flow: fill credentials, submit, redirected to /dashboard', async ({ page }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password)

    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('login with wrong password: shows error message', async ({ page }) => {
    await login(page, ADMIN_USER.email, 'WrongPassword999!')

    await expect(page.locator('text=Invalid email or password')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('login with non-existent email: shows error', async ({ page }) => {
    await login(page, 'nonexistent-user-xyz@menke-test.com', 'Password123!')

    await expect(page.locator('text=Invalid email or password')).toBeVisible({ timeout: 10000 })
  })

  test('login with empty fields: validation blocks submission', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)

    // Both email and password inputs have required attribute
    await page.click('button[type="submit"]')

    // Browser native validation should prevent submission; page stays on /login
    await expect(page).toHaveURL(/\/login/)
  })
})

// ---------------------------------------------------------------------------
// 3. Protected routes redirect unauthenticated users
// ---------------------------------------------------------------------------
test.describe('Auth protection', () => {
  test('dashboard requires auth: /dashboard redirects to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await expect(page).toHaveURL(/\/login/)
  })

  test('settings requires auth: /settings redirects to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await expect(page).toHaveURL(/\/login/)
  })

  test('import requires auth: /import redirects to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/import`)
    await expect(page).toHaveURL(/\/login/)
  })

  test('profile requires auth: /profile redirects to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`)
    await expect(page).toHaveURL(/\/login/)
  })

  test('admin requires auth: /admin redirects to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`)
    await expect(page).toHaveURL(/\/login/)
  })

  test('middleware: all 12 protected paths redirect when not authenticated', async ({ page }) => {
    const protectedPaths = [
      '/dashboard', '/valuation', '/population', '/repurchase',
      '/success-score', '/settings', '/import', '/manage',
      '/profile', '/admin', '/history', '/report',
    ]

    for (const path of protectedPaths) {
      await page.goto(`${BASE_URL}${path}`)
      await expect(page).toHaveURL(/\/login/, {
        timeout: 10000,
      })
    }
  })
})

// ---------------------------------------------------------------------------
// 4. Authenticated user on /login redirects to /dashboard
// ---------------------------------------------------------------------------
test.describe('Auth redirects for logged-in user', () => {
  test('authenticated user on /login: redirects to /dashboard', async ({ page }) => {
    // Log in first
    await login(page, ADMIN_USER.email, ADMIN_USER.password)
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })

    // Now visit /login again
    await page.goto(`${BASE_URL}/login`)
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

// ---------------------------------------------------------------------------
// 5. Logout
// ---------------------------------------------------------------------------
test.describe('Logout', () => {
  test('logout: click logout, redirected to /login', async ({ page }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password)
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })

    // Open the avatar dropdown and click Sign out
    await page.locator('[class*="AvatarFallback"], [class*="avatar"]').first().click()
    await page.locator('text=Sign out').click()

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// 6. Session persistence
// ---------------------------------------------------------------------------
test.describe('Session persistence', () => {
  test('login, refresh page, still on dashboard', async ({ page }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password)
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })

    // Refresh the page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Should still be on dashboard, not redirected to login
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.locator('h1')).toContainText('Dashboard')
  })
})

// ---------------------------------------------------------------------------
// 7. Full register-then-login flow
// ---------------------------------------------------------------------------
test.describe('Full registration to login', () => {
  test('register then login: complete flow', async ({ page }) => {
    const newUser = {
      username: 'FullFlowUser',
      email: `fullflow-${Date.now()}@menke-test.com`,
      password: 'FullFlowPass123!',
    }

    // Step 1: Register
    await page.goto(`${BASE_URL}/register`)
    await page.fill('input#username', newUser.username)
    await page.fill('input#email', newUser.email)
    await page.fill('input#password', newUser.password)
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Registration Successful')).toBeVisible({ timeout: 10000 })

    // Step 2: Navigate to login
    await page.click('text=Go to Login')
    await expect(page).toHaveURL(/\/login/)

    // Step 3: Login with the new credentials
    await page.fill('input#email', newUser.email)
    await page.fill('input#password', newUser.password)
    await page.click('button[type="submit"]')

    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })
    await expect(page.locator('h1')).toContainText('Dashboard')
  })
})

// ---------------------------------------------------------------------------
// 8. Profile page shows username
// ---------------------------------------------------------------------------
test.describe('Profile page', () => {
  test('profile page shows username', async ({ page }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password)
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })

    await page.goto(`${BASE_URL}/profile`)
    await page.waitForLoadState('networkidle')

    // Profile page should display the username input with a value
    const usernameInput = page.locator('input#username, input[name="username"]').first()
    await expect(usernameInput).toBeVisible({ timeout: 10000 })
    const value = await usernameInput.inputValue()
    expect(value.length).toBeGreaterThan(0)
  })

  test('profile update works', async ({ page }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password)
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })

    await page.goto(`${BASE_URL}/profile`)
    await page.waitForLoadState('networkidle')

    // Update the company name field
    const companyInput = page.locator('input#company_name, input[name="company_name"]').first()
    await expect(companyInput).toBeVisible({ timeout: 10000 })
    await companyInput.fill(`TestCo-${Date.now()}`)

    // Click save
    await page.click('button[type="submit"]')

    // Expect success message
    await expect(page.locator('text=Profile updated successfully')).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// 9. Admin page shows user table
// ---------------------------------------------------------------------------
test.describe('Admin page', () => {
  test('admin page shows user table (admin user)', async ({ page }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password)
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 })

    await page.goto(`${BASE_URL}/admin`)
    await page.waitForLoadState('networkidle')

    // The admin page should render a table with user data
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })

    // Expect at least one row in the table body
    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 10000 })
  })
})
