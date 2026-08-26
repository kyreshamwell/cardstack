// e2e/dashboard.spec.ts
//
// The signed-in surface. These are the tests that would catch a regression no
// other layer can see: the dashboard assembling real data from Supabase and
// Plaid through a real browser.
//
// They are SKIPPED until a dedicated test account is configured, because they
// need credentials this repo must never contain. To enable them, add to
// .env.local (and to CI secrets):
//
//   E2E_CLERK_USER_EMAIL=e2e@yourdomain.test
//   E2E_CLERK_USER_PASSWORD=…
//
// Create that user in the Clerk dashboard as a normal user. Point it at a
// Supabase project seeded with fixture cards, NOT your own account, or a
// failing test could delete real cards.
//
// Clerk's bot protection blocks scripted sign-in on production instances;
// setupClerkTestingToken() is what gets past it, which is why @clerk/testing
// exists rather than just typing into the form.
//
// Note the sign-in form now lives in the (marketing) filmstrip rather than on
// its own page, and Clerk runs in `routing="virtual"`. The multi-step flow
// happens in place without changing the URL, so the steps below fill fields on
// one screen rather than following Clerk's own sub-paths.

import { expect, test } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'

const EMAIL = process.env.E2E_CLERK_USER_EMAIL
const PASSWORD = process.env.E2E_CLERK_USER_PASSWORD
const CONFIGURED = Boolean(EMAIL && PASSWORD)

test.describe('signed-in dashboard', () => {
  test.skip(
    !CONFIGURED,
    'Set E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD to run these.'
  )

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page })

    await page.goto('/sign-in')
    await page.getByLabel(/email/i).fill(EMAIL!)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.getByLabel(/password/i).fill(PASSWORD!)
    await page.getByRole('button', { name: /continue/i }).click()

    await page.waitForURL(/dashboard/)
  })

  test('lands on the dashboard rather than the marketing page', async ({ page }) => {
    // The auth-aware redirect: a signed-in user must never see the pitch.
    await page.goto('/')
    await expect(page).toHaveURL(/dashboard/)
  })

  test('renders the balance headline and the chart', async ({ page }) => {
    await expect(page.getByText(/balance/i).first()).toBeVisible()
    await expect(page.locator('svg circle').first()).toBeVisible()
  })

  test('the whole page does not scroll', async ({ page }) => {
    // The core layout promise, and DESKTOP-ONLY since the phone rewrite: below
    // xl the dashboard is tabs and the document scrolls on purpose. Playwright's
    // default viewport is 1280 wide, which is the desktop layout.
    const overflows = await page.evaluate(
      () => document.body.scrollHeight > window.innerHeight + 2
    )
    expect(overflows).toBe(false)
  })

  test('privacy mode blurs every sensitive figure', async ({ page }) => {
    await page.getByRole('button', { name: /hide balances/i }).click()

    const blurred = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.sensitive-value')]
      return nodes.length > 0 && nodes.every((n) => getComputedStyle(n).filter.includes('blur'))
    })

    expect(blurred).toBe(true)
  })

  test('the utilization explainer is NOT shown here', async ({ page }) => {
    // The counterpart to the demo's assertion. `DashboardView`'s `explain` prop
    // defaults to false and only the demo opts in. The demo is a teaching
    // surface, your own dashboard isn't, and a permanent explainer you can't
    // dismiss is clutter. The section itself must still be here.
    await expect(page.getByText('Lower reported utilization')).toBeVisible()
    await expect(
      page.getByText(/Utilization reports when a statement closes/)
    ).toHaveCount(0)
  })

  test('expanding a card reveals its detail rows', async ({ page }) => {
    await page.locator('[data-card-id]').first().getByRole('button').first().click()
    await expect(page.getByText('Credit limit').first()).toBeVisible()
  })

  test('refreshing does not wipe a manually entered limit', async ({ page }) => {
    // The regression that motivated limit_is_manual. Reads the limit, syncs,
    // and checks it survived.
    const card = page.locator('[data-card-id]').first()
    await card.getByRole('button').first().click()

    const before = await page.getByText(/^\$[\d,]+\.\d{2}$/).first().textContent()

    await page.getByRole('button', { name: /refresh/i }).click()
    await page.waitForTimeout(3000)

    await card.getByRole('button').first().click()
    const after = await page.getByText(/^\$[\d,]+\.\d{2}$/).first().textContent()

    expect(after).toBe(before)
  })
})
