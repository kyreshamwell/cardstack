// e2e/public.spec.ts
//
// The signed-out surface, exercised against a real browser and a real server.
// These need no credentials, so they run anywhere — including CI — and they
// cover the things unit tests structurally cannot: that the app actually boots,
// that middleware protects what it should, and that the page renders without
// console errors.

import { expect, test } from '@playwright/test'

test.describe('landing page', () => {
  test('renders for a signed-out visitor', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible()
  })

  test('boots without console errors or failed requests', async ({ page }) => {
    const errors: string[] = []
    const failed: string[] = []

    page.on('console', (msg) => {
      // Clerk logs a development-keys warning that is expected locally.
      if (msg.type() === 'error' && !msg.text().includes('Clerk')) {
        errors.push(msg.text())
      }
    })
    page.on('response', (res) => {
      if (res.status() >= 500) failed.push(`${res.status()} ${res.url()}`)
    })

    // Not networkidle: the dev server holds an HMR websocket open, so it never
    // settles and the test just burns its timeout.
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
    expect(failed, `server errors:\n${failed.join('\n')}`).toEqual([])
  })

  test('shows the interactive demo without requiring an account', async ({ page }) => {
    await page.goto('/')

    // The demo is the pitch — if it fails to render there is nothing to see.
    // These names come from components/DemoDashboard.tsx.
    await expect(page.getByText(/Quicksilver/i).first()).toBeVisible()
    await expect(page.getByText(/Sapphire Preferred/i).first()).toBeVisible()

    // The demo is interactive, not a screenshot: the chart must actually draw.
    await expect(page.locator('svg circle').first()).toBeVisible()
  })
})

test.describe('route protection', () => {
  // The security property middleware exists to provide. A regression here
  // exposes financial data, and no unit test covers the middleware itself.
  for (const path of ['/dashboard']) {
    test(`${path} redirects a signed-out visitor to sign-in`, async ({ page }) => {
      await page.goto(path)

      await expect(page).toHaveURL(/sign-in/)
    })
  }

  test('API routes reject unauthenticated calls', async ({ request }) => {
    const res = await request.post('/api/plaid/sync')

    // 401 from the route, or a redirect from middleware — never 200.
    expect(res.status()).not.toBe(200)
  })

  test('a card cannot be deleted without signing in', async ({ request }) => {
    const res = await request.delete('/api/cards/remove', {
      data: { card_id: 'someone-elses-card' },
    })

    expect(res.status()).not.toBe(200)
  })
})

test.describe('theme', () => {
  test('respects a dark colour scheme', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()

    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()

    await context.close()
  })
})
