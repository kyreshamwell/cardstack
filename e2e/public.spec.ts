// e2e/public.spec.ts
//
// The signed-out surface, exercised against a real browser and a real server.
// These need no credentials, so they run anywhere (including CI) and they
// cover what unit tests structurally cannot: that the app boots, that
// middleware protects what it should, and that the pages render without
// console errors.
//
// ── The one rule for writing tests in this file ───────────────────────────
//
// All three public panels (demo, landing, auth) are mounted at ALL times.
// The route only decides which is on screen (see MarketingFrame). So a bare
// `getByRole('heading', { level: 1 })` matches the landing hero AND the auth
// panel's heading and fails on strict mode, and `[data-card-id]` finds the
// demo's rows from the landing page.
//
// Scope to `activePanel(page)`, or assert on the `data-active` attribute.
// Counting elements proves nothing about what a visitor can actually see.

import { expect, test, type Page } from '@playwright/test'

/** The panel currently on screen. Everything inside a page assertion goes through this. */
function activePanel(page: Page) {
  return page.locator('[data-panel][data-active="true"]')
}

/** Collects console errors, ignoring Clerk's expected development-keys warning. */
function watchConsole(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('Clerk')) errors.push(msg.text())
  })
  return errors
}

test.describe('landing page', () => {
  test('renders for a signed-out visitor', async ({ page }) => {
    await page.goto('/')

    const panel = activePanel(page)
    await expect(panel).toHaveAttribute('data-panel', 'landing')
    await expect(panel.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(panel.getByRole('link', { name: /see it running/i })).toBeVisible()
    await expect(panel.getByRole('link', { name: /create an account/i })).toBeVisible()
  })

  test('boots without console errors or failed requests', async ({ page }) => {
    const errors = watchConsole(page)
    const failed: string[] = []
    page.on('response', (res) => {
      if (res.status() >= 500) failed.push(`${res.status()} ${res.url()}`)
    })

    // Not networkidle: the dev server holds an HMR websocket open, so it never
    // settles and the test just burns its timeout.
    await page.goto('/')
    await expect(activePanel(page).getByRole('heading', { level: 1 })).toBeVisible()

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
    expect(failed, `server errors:\n${failed.join('\n')}`).toEqual([])
  })

  test('the headline is readable as text, not just as animation', async ({ page }) => {
    // The hero types itself out one character at a time, with the finished
    // string in an sr-only node so assistive tech gets it once instead of
    // hearing every half-typed state. If that node ever goes, the page has no
    // accessible headline at all and nothing else would catch it.
    await page.goto('/')

    await expect(activePanel(page).getByRole('heading', { level: 1 })).toHaveText(
      /Every card\.\s*One screen\./
    )
  })
})

test.describe('landing → demo', () => {
  // The whole point of the marketing page: the demo opens in place. If this
  // ever becomes a document navigation the effect is gone, and nothing about
  // the rendered output would tell you, hence asserting on the mechanism.
  test('opens the demo without loading a new page', async ({ page }) => {
    await page.goto('/')

    // Survives a soft navigation, dies on a document load.
    await page.evaluate(() => {
      ;(window as unknown as { __soft?: number }).__soft = 1
    })

    await page.getByRole('link', { name: /see it running/i }).click()

    await expect(page).toHaveURL(/\/demo$/)
    await expect(activePanel(page)).toHaveAttribute('data-panel', 'demo')

    const survived = await page.evaluate(
      () => (window as unknown as { __soft?: number }).__soft
    )
    expect(survived, 'a document load would have cleared this').toBe(1)
  })

  test('the nav swaps to the demo cluster and back', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav')

    await expect(nav.getByRole('link', { name: /^sign in$/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /exit demo/i })).toHaveCount(0)

    await page.getByRole('link', { name: /see it running/i }).click()
    await expect(nav.getByRole('link', { name: /exit demo/i })).toBeVisible()

    await nav.getByRole('link', { name: /exit demo/i }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(activePanel(page)).toHaveAttribute('data-panel', 'landing')
  })

  test('the back button returns to the pitch', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /see it running/i }).click()
    await expect(page).toHaveURL(/\/demo$/)

    await page.goBack()

    await expect(page).toHaveURL(/\/$/)
    await expect(activePanel(page)).toHaveAttribute('data-panel', 'landing')
  })
})

test.describe('demo', () => {
  // /demo renders the REAL dashboard components on fixture data with no
  // credentials, so everything here is coverage of the actual app that would
  // otherwise need a seeded account.
  test('is public and renders the real dashboard', async ({ page }) => {
    await page.goto('/demo')
    const panel = activePanel(page)

    await expect(page).toHaveURL(/\/demo$/)
    await expect(panel).toHaveAttribute('data-panel', 'demo')
    await expect(panel.getByText('Statement balance')).toBeVisible()
    await expect(panel.getByText('Recent activity')).toBeVisible()
    await expect(panel.locator('[data-card-id]')).toHaveCount(5)
  })

  test('the utilization section is named for its outcome', async ({ page }) => {
    // Renamed from "Pay before close", which said when to act but never what
    // for. The figure under it reads as a bill otherwise, sitting alongside a
    // minimum payment and a statement balance for the same card.
    await page.goto('/demo')
    const panel = activePanel(page)

    await expect(panel.getByText('Lower reported utilization')).toBeVisible()
    // `77% → 30%` is what marks the figure as a utilization move.
    await expect(panel.getByText(/%\s*→\s*30%/)).toBeVisible()
  })

  test('the explainer is shown here but is demo-only', async ({ page }) => {
    // `DashboardView`'s `explain` prop. The demo is a teaching surface; the
    // real dashboard passes nothing and must not render this.
    await page.goto('/demo')

    await expect(
      activePanel(page).getByText(/Utilization reports when a statement closes/)
    ).toBeVisible()
  })

  test('boots without console errors', async ({ page }) => {
    const errors = watchConsole(page)

    await page.goto('/demo')
    await expect(activePanel(page).locator('[data-card-id]').first()).toBeVisible()

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
  })

  test('holds the fixed viewport on desktop: the page itself never scrolls', async ({
    page,
  }) => {
    await page.goto('/demo')
    await expect(activePanel(page).locator('[data-card-id]').first()).toBeVisible()

    const overflows = await page.evaluate(
      () => document.body.scrollHeight > window.innerHeight + 2
    )
    expect(overflows).toBe(false)
  })

  test('privacy mode blurs every figure, chart included', async ({ page }) => {
    await page.goto('/demo')
    await expect(activePanel(page).locator('[data-card-id]').first()).toBeVisible()

    await page.getByRole('button', { name: /hide balances/i }).click()

    const blurred = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.sensitive-value')]
      return {
        count: nodes.length,
        allBlurred: nodes.every((n) => getComputedStyle(n).filter.includes('blur')),
      }
    })

    expect(blurred.count).toBeGreaterThan(20)
    expect(blurred.allBlurred).toBe(true)
  })

  test('a write action asks for an account instead of doing anything', async ({ page }) => {
    await page.goto('/demo')

    await page.getByRole('button', { name: /^connect$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/needs a real account/i)).toBeVisible()

    await page.getByRole('button', { name: /keep exploring/i }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('"Pay this card" is inert: it must not link out to a bank', async ({ page }) => {
    // The real button is an <a> to the bank's own site. Sending a sample
    // visitor to chase.com from a fake Chase card isn't ours to do, so the
    // demo renders a dead lookalike.
    await page.goto('/demo')
    const card = activePanel(page).locator('[data-card-id]').first()
    await card.getByRole('button').first().click()

    await expect(card.getByText(/Pay this card/)).toBeVisible()
    await expect(card.locator('a[href^="http"]')).toHaveCount(0)
  })

  test('clicking a card in the chart isolates it, and again restores', async ({ page }) => {
    await page.goto('/demo')
    const panel = activePanel(page)
    await expect(panel.locator('[data-card-id]')).toHaveCount(5)

    // By the vendored LegendLabel's own class, not by text alone: on hover the
    // pie's CENTRE label also reads "Sapphire Preferred", it sits under the
    // SVG, and Playwright picks it first, then waits for an element the chart
    // is covering.
    const legendRow = panel
      .locator('span.text-legend-foreground')
      .filter({ hasText: 'Sapphire Preferred' })

    await legendRow.click()
    await expect(page.getByText(/show all cards/i)).toBeVisible()
    await expect(
      panel.locator('[data-card-id]:not([style*="display: none"])')
    ).toHaveCount(1)

    // The toggle: clicking the focused card again restores every card.
    await legendRow.click()
    await expect(page.getByText(/show all cards/i)).toHaveCount(0)
    await expect(
      panel.locator('[data-card-id]:not([style*="display: none"])')
    ).toHaveCount(5)
  })
})

test.describe('auth panel', () => {
  test('sign-in and sign-up are one panel in two states', async ({ page }) => {
    await page.goto('/sign-in')
    const panel = activePanel(page)

    await expect(panel).toHaveAttribute('data-panel', 'auth')
    await expect(panel.getByRole('heading', { name: /welcome back/i })).toBeVisible()

    await panel.getByRole('link', { name: /create account/i }).click()

    await expect(page).toHaveURL(/\/sign-up$/)
    await expect(panel.getByRole('heading', { name: /create your account/i })).toBeVisible()
    // Still the same panel: this is a state change, not a navigation away.
    await expect(activePanel(page)).toHaveAttribute('data-panel', 'auth')
  })

  test('offers Google and Apple alongside email', async ({ page }) => {
    // These only render once the connections are enabled in Clerk's dashboard,
    // so this also fails loudly if someone turns them off.
    //
    // The slowest test in the suite, and legitimately so: on a cold dev server
    // this waits for the route to compile, THEN for Clerk's script to load,
     // THEN for Clerk to fetch its environment over the network, and only then
    // does the form mount. Most of that is a third-party round trip rather than
    // anything we render, so it gets the long timeout instead of being made
    // conditional or deleted.
    test.slow()

    await page.goto('/sign-in')
    const panel = activePanel(page)

    await expect(panel.getByRole('button', { name: /continue with google/i })).toBeVisible({
      timeout: 45_000,
    })
    await expect(panel.getByRole('button', { name: /continue with apple/i })).toBeVisible()
    await expect(panel.getByLabel(/email/i)).toBeVisible()
  })

  test('offers the demo as a way out', async ({ page }) => {
    await page.goto('/sign-in')

    await activePanel(page).getByRole('link', { name: /try the demo instead/i }).click()
    await expect(page).toHaveURL(/\/demo$/)
    await expect(activePanel(page)).toHaveAttribute('data-panel', 'demo')
  })

  test('boots without console errors', async ({ page }) => {
    const errors = watchConsole(page)

    await page.goto('/sign-in')
    await expect(activePanel(page).getByRole('heading', { level: 1 })).toBeVisible()

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
  })
})

test.describe('phone layout', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  // Below xl the dashboard is a different layout, not the desktop one reflowed:
  // tabs, and the DOCUMENT scrolls rather than an inner box. Measured on this
  // exact viewport before the rewrite: four nested scrollers, one 0px tall and
  // another 37px holding 998px of content, with labels overlapping the rows.
  test('the dashboard becomes tabs', async ({ page }) => {
    await page.goto('/demo')

    await expect(page.getByRole('tab', { name: 'Cards' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Activity' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Insights' })).toBeVisible()

    // The balance sits outside the tabs, the one number worth seeing without
    // having to choose to look for it.
    await expect(activePanel(page).getByText('Statement balance')).toBeVisible()
  })

  test('switching tabs swaps the region', async ({ page }) => {
    await page.goto('/demo')
    const panel = activePanel(page)

    await expect(panel.locator('[data-card-id]')).toHaveCount(5)

    await page.getByRole('tab', { name: 'Activity' }).click()
    await expect(panel.locator('[data-card-id]')).toHaveCount(0)
    await expect(panel.getByText('Recent activity')).toBeVisible()

    await page.getByRole('tab', { name: 'Insights' }).click()
    await expect(panel.getByText('Lower reported utilization')).toBeVisible()
  })

  test('the document scrolls, and nothing scrolls inside it', async ({ page }) => {
    // Nested scrollers eat a swipe meant for the page, and iOS only collapses
    // its address bar for document scroll. Both were why this felt wrong.
    await page.goto('/demo')
    await page.getByRole('tab', { name: 'Activity' }).click()
    await expect(activePanel(page).getByText('Recent activity')).toBeVisible()

    const scroll = await page.evaluate(() => ({
      documentScrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
      innerScrollers: [...document.querySelectorAll('*')].filter((e) => {
        const cs = getComputedStyle(e)
        return (
          (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
          e.scrollHeight > e.clientHeight + 2
        )
      }).length,
      horizontal:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }))

    expect(scroll.documentScrolls).toBe(true)
    expect(scroll.innerScrollers).toBe(0)
    expect(scroll.horizontal, 'a phone must never scroll sideways').toBe(false)
  })

  test('the tab bar stays reachable once scrolled', async ({ page }) => {
    await page.goto('/demo')
    await page.getByRole('tab', { name: 'Activity' }).click()

    await page.evaluate(() => window.scrollTo(0, 600))

    const tab = page.getByRole('tab', { name: 'Cards' })
    await expect(tab).toBeInViewport()
    await tab.click()
    await expect(activePanel(page).locator('[data-card-id]')).toHaveCount(5)
  })

  test('tapping a card in the chart brings you to the rows', async ({ page }) => {
    // The chart is in Insights and the rows are in Cards, so isolating a card
    // has to switch tabs or it appears to do nothing at all. The tap also has
    // to work with no hover first, which used to be dead on touch entirely.
    await page.goto('/demo')
    await page.getByRole('tab', { name: 'Insights' }).click()

    await activePanel(page)
      .locator('span.text-legend-foreground')
      .filter({ hasText: 'Sapphire Preferred' })
      .click()

    await expect(page.getByRole('tab', { name: 'Cards' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(
      activePanel(page).locator('[data-card-id]:not([style*="display: none"])')
    ).toHaveCount(1)
  })

  test('the landing hero is centred, not parked at the top', async ({ page }) => {
    // Percentage heights stop resolving once the shell is no longer h-dvh, so
    // the hero collapsed to its content and sat against the nav.
    await page.goto('/')

    const gaps = await page.evaluate(() => {
      const main = document.querySelector('main')!
      const block = document.querySelector('main h1')!.parentElement!
      const m = main.getBoundingClientRect()
      const b = block.getBoundingClientRect()
      return { above: b.top - m.top, below: m.bottom - b.bottom }
    })

    expect(gaps.above).toBeGreaterThan(40)
    // Centred to within a reasonable margin, rather than pinned to either end.
    expect(Math.abs(gaps.above - gaps.below)).toBeLessThan(60)
  })

  // The filmstrip used to be desktop-only. Below xl the inactive panels were
  // hidden and the track pinned to `transform: none`, so a phone got the panel
  // swap with none of the motion, measured on this viewport as exactly two
  // positions, the before and the after, with nothing in between.
  //
  // Both halves are asserted here, because either one alone is a bug: a slide
  // that never tears itself down leaves the phone carrying three panels of
  // document height, and a teardown with no slide is the original defect back
  // again.
  test('the demo slides in, then hands the page back to the document', async ({ page }) => {
    await page.goto('/')
    await expect(activePanel(page).getByRole('heading', { level: 1 })).toBeVisible()

    // Sample the demo panel's position every frame across the navigation.
    // Unbounded rather than a fixed frame count: a cold dev server can take
    // seconds to compile /demo, and a cap short enough to be useful is also
    // short enough to expire before the move starts.
    await page.evaluate(() => {
      const w = window as unknown as { __x: number[]; __stop: boolean }
      w.__x = []
      w.__stop = false
      const tick = () => {
        const demo = document.querySelector('[data-panel="demo"]')
        if (demo) w.__x.push(Math.round(demo.getBoundingClientRect().x))
        if (!w.__stop && w.__x.length < 100_000) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    await page.locator('[data-panel="landing"] a[href="/demo"]').first().click()
    await expect(activePanel(page).locator('[data-card-id]').first()).toBeVisible()
    // The attribute clears when the spring settles, which is the strip's own
    // signal that it has finished and dismantled itself.
    await expect(page.locator('.filmstrip-track')).toHaveAttribute('data-sliding', 'false')

    const travelled = await page.evaluate(() => {
      const w = window as unknown as { __x: number[]; __stop: boolean }
      w.__stop = true
      return new Set(w.__x).size
    })
    expect(travelled, 'the demo panel should travel, not teleport').toBeGreaterThan(3)

    // Landed: one panel in flow, no transform, no pinned height, i.e. exactly
    // the resting layout the other tests in this block depend on.
    const rest = await page.evaluate(() => {
      const track = document.querySelector('.filmstrip-track') as HTMLElement
      return {
        panelsInFlow: [...document.querySelectorAll('[data-panel]')].filter(
          (p) => getComputedStyle(p).display !== 'none'
        ).length,
        transform: getComputedStyle(track).transform,
        pinnedHeight: track.style.height,
      }
    })

    expect(rest.panelsInFlow).toBe(1)
    expect(rest.transform).toBe('none')
    expect(rest.pinnedHeight).toBe('')
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

  test('the demo and the OAuth callback stay public', async ({ page }) => {
    // /sso-callback must not be protected: the session does not exist yet when
    // the browser lands there, so protecting it would bounce to /sign-in and
    // throw away the OAuth response in the URL.
    for (const path of ['/demo', '/sso-callback']) {
      await page.goto(path)
      await expect(page).not.toHaveURL(/sign-in/)
    }
  })

  test('API routes reject unauthenticated calls', async ({ request }) => {
    const res = await request.post('/api/plaid/sync')

    // 401 from the route, or a redirect from middleware. Never 200.
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
    // The only test that opens a fresh browser context, so on a cold dev
    // server it pays for the route's first compile itself, which overran the
    // default 30s timeout and made this the suite's one flaky test. Nothing
    // about the assertion is slow; the wait is the compiler.
    test.slow()

    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()

    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()

    // The blocking script in <head> must apply the class before first paint,
    // or a dark-mode device gets a white flash on every load.
    await expect(page.locator('html')).toHaveClass(/dark/)

    await context.close()
  })
})
