'use client'
// components/landing/MarketingFrame.tsx
//
// The public app is one filmstrip of three panels, with the pitch in the
// middle:
//
//     [ demo ] ← [ landing ] → [ sign in / sign up ]
//
// Going to the demo slides the strip RIGHT, so the pitch exits right and the
// demo arrives from the left. Going to sign-in slides it LEFT, the exact
// opposite — so the two destinations sit on opposite sides and you always know
// which way you came from. Each is a full page in its own right.
//
// A drawer version of the auth panel was tried, where the landing page stayed
// on screen and squeezed to half width while the form opened beside it. It
// worked, but sign-in reads as a destination rather than something opened next
// to the pitch, so it went back to being its own panel.
//
// The AppShell around all of it — nav, brand, frame — never moves and never
// unmounts.
//
// Both panels stay mounted the whole time, which is the load-bearing decision
// here. Three earlier versions did not, and each failed differently:
//
//   1. Local state + history.pushState. The App Router remounts the route tree
//      when the URL is pushed underneath it, so the view reset to the landing
//      page every time — address bar on /demo, hero still on screen.
//   2. A cross-fade with AnimatePresence mode="wait". Correct, but it reads as
//      lag: 0.28s fading out, a dead beat, then 0.28s fading in. Nothing is
//      actually moving for most of the transition.
//   3. A slide with AnimatePresence mode="sync". In a Next LAYOUT the exiting
//      child cannot keep the old page's `children` — that prop has already
//      been replaced — so the panel sliding out re-rendered as the demo too,
//      and two dashboards crossed the screen. The usual fix freezes an
//      internal Next router context: a lot of fragility for one transition.
//
// Mounting both removes the entire class of problem. There is no enter, no
// exit and no unmount to coordinate — just one transform. It also means the
// demo is built and painted before it is ever asked for, so the slide has
// nothing to compile or mount mid-flight, which is most of why this now feels
// immediate rather than sluggish.
//
// The cost is that the routes' `children` go unused: the layout owns both
// panels, and the pages under it exist to own the URL, the metadata, and the
// signed-in redirect.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { AppShell } from '@/components/dashboard/AppShell'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { PrivacyToggle } from '@/components/cards/PrivacyToggle'
import { LandingHero } from '@/components/landing/LandingHero'
import { AuthPanel } from '@/components/landing/AuthPanel'
import { DemoDashboard } from '@/components/demo/DemoDashboard'

// Order on the strip, left to right. The index is the whole routing rule.
const PANELS = ['demo', 'landing', 'auth'] as const
type PanelName = (typeof PANELS)[number]

function panelForPath(pathname: string): PanelName {
  if (pathname.startsWith('/demo')) return 'demo'
  // startsWith, not equality: Clerk walks through sub-paths of its own during
  // multi-step flows (/sign-in/factor-one, /sign-up/verify-email-address…),
  // and every one of them has to keep the auth panel on screen.
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) return 'auth'
  return 'landing'
}

export function MarketingFrame({ now }: { now: number }) {
  const pathname = usePathname()
  const panel = panelForPath(pathname)
  const onDemo = panel === 'demo'
  const onAuth = panel === 'auth'
  const reduce = useReducedMotion()

  const index = PANELS.indexOf(panel)
  // Whole multiples of 100%, which matters more than it looks.
  //
  // The track used to be 300% wide with 1/3-width panels, moved by -33.3333%.
  // A third is not exactly 33.3333%, so each step landed a hundredth of a pixel
  // short and left a sliver of the neighbouring panel on screen — which is why
  // the demo's scrollbar was visible as a hairline down the left edge of the
  // landing page. The track is now container-width with panels that each
  // overflow it at 100%, so one step is exactly one panel with no rounding.
  //
  // Written so index 0 yields "0%" rather than "-0%": Motion accepts negative
  // zero and then never animates away from it.
  const offset = `${-index * 100}%`

  // A spring, not a duration. Easing curves make a transition feel scripted;
  // a spring settles, which is what makes it feel physical. Damped just short
  // of visible bounce — this carries a whole dashboard across the screen, and
  // overshoot at that size reads as a mistake rather than a flourish.
  const spring = { type: 'spring' as const, stiffness: 260, damping: 34, mass: 0.9 }
  const move = reduce ? { duration: 0 } : spring

  return (
    <AppShell
      brandHref="/"
      navRight={
        /*
          Keyed, enter-only. An AnimatePresence here left the cluster stuck on
          the landing version — the exit never resolved, so the entering one
          never mounted. Changing the key unmounts the old cluster outright and
          fades the new one in, with no half-finished state to get stuck in.
          The slide below carries the moment; the nav only has to keep up.
        */
        <motion.div
          animate={{ opacity: 1 }}
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          key={`${panel}-nav`}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          {/*
            Outside the per-panel branches on purpose. Light/dark is a property
            of the whole site, not of the demo — it used to live only in the
            demo's nav cluster, so the pitch and the auth form had no way to
            change it and no way to show which mode you were in.
          */}
          <DarkModeToggle />

          {panel === 'demo' && (
            <>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-3">
                <span className="h-1.5 w-1.5 rounded-full bg-good" />
                Sample data
              </span>
              {/* Privacy stays demo-only: it blurs figures, and the pitch and
                  the sign-in form have none to blur. */}
              <PrivacyToggle />
              <Link
                className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-raised hover:text-ink transition-colors"
                href="/"
              >
                Exit demo
              </Link>
              <Link
                className="whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-ground hover:opacity-90 transition-opacity"
                href="/sign-in"
              >
                Sign in
              </Link>
            </>
          )}

          {panel === 'landing' && (
            <Link
              className="text-sm font-medium text-ink-2 hover:text-ink transition-colors"
              href="/sign-in"
            >
              Sign in
            </Link>
          )}

          {/* On the auth panel the only useful move is back — a "Sign in"
              button pointing at the form already on screen is noise. */}
          {panel === 'auth' && (
            <Link
              className="flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
              href="/"
            >
              <span aria-hidden="true">←</span>
              Back
            </Link>
          )}
        </motion.div>
      }
    >
      {/*
        `overflow-clip`, deliberately, NOT `overflow-hidden`.

        Hidden still creates a scroll container, and the browser will scroll one
        to reveal a focused descendant. Clerk autofocuses its email field the
        moment it mounts, and if that happens while the field is off-screen the
        browser scrolls the container to it — which then stacks on top of the
        transform and leaves every later move one panel out.

        `clip` creates no scroll container, so there is nothing to scroll.
      */}
      {/*
        Horizontal clipping only below xl. `overflow-clip` on both axes makes
        these scroll containers, and a flex item that is a scroll container has
        `min-height: auto` resolve to 0 — so instead of growing to fit a tall
        dashboard, the panel simply clipped it and the page stopped scrolling.
        The filmstrip only ever needs the horizontal axis clipped.
      */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-x-clip xl:block xl:h-full xl:flex-none xl:overflow-clip">
        <motion.div
          animate={{ x: offset }}
          // `flex-1` below xl so the track fills whatever height main has, and
          // default `items-stretch` so the visible panel fills it in turn. A
          // percentage `min-h-full` on the panel can't do this — the track's
          // height is auto there, and a percentage against auto resolves to
          // nothing, which left the landing hero collapsed to its content and
          // parked at the top of a much taller screen.
          className="filmstrip-track flex flex-1 xl:h-full xl:flex-none"
          // No enter animation: on a cold load the strip must already be at the
          // right offset, or /demo would slide in from nowhere on first paint.
          initial={false}
          style={{ willChange: 'transform' }}
          transition={move}
        >
          <Panel active={onDemo} name="demo">
            <DemoDashboard now={now} />
          </Panel>
          <Panel active={panel === 'landing'} name="landing">
            <LandingHero />
          </Panel>
          <Panel active={onAuth} name="auth">
            <AuthPanel active={onAuth} mode={pathname.startsWith('/sign-up') ? 'sign-up' : 'sign-in'} />
          </Panel>
        </motion.div>
      </div>
    </AppShell>
  )
}

/**
 * One viewport of the filmstrip.
 *
 * `inert` on whichever panels are off screen, which does the whole job in one
 * attribute: no pointer events, no focus, and hidden from the accessibility
 * tree. All three panels are in the DOM at all times, so without it a screen
 * reader would read the demo's balances aloud on the marketing page, Tab would
 * walk into a dashboard nobody can see, and — the one that actually bit —
 * anything off-stage taking focus makes the browser scroll the strip to it.
 */
function Panel({
  active,
  children,
  name,
}: {
  active: boolean
  children: React.ReactNode
  name: string
}) {
  return (
    <div
      // `overflow-clip` on each panel, not just on the track.
      //
      // The dashboard's scrolling regions use `-mx-1 px-1` to let their content
      // sit flush while the scrollbar hangs outside — which means they extend
      // 4px past the panel's own edge. The track clips at the container, but
      // the panel edge is one full viewport further along, so the demo's
      // right-most scrollbar was painting into the landing page as a hairline
      // down its left edge. Each panel now clips to itself. `clip` rather than
      // `hidden` so no scroll container is created here either.
      // Only the panel on screen contributes height. All three are mounted at
      // all times, so on a phone — where the document height IS the tallest
      // panel — an inactive dashboard would leave the landing page with a
      // screenful of empty scroll below it.
      className={`min-h-0 w-full shrink-0 overflow-x-clip xl:h-full xl:overflow-clip ${
        active ? '' : 'hidden xl:block'
      }`}
      // Belt and braces with the overflow-clip above.
      //
      // The dashboard's scroll regions use `-mx-1 px-1` so their content sits
      // flush while the scrollbar hangs 4px OUTSIDE the box. Overflow clipping
      // is the correct fix and works — but scrollbar gutters are painted by the
      // compositor and have a history of surviving it, and the symptom is the
      // demo's scrollbar drawn as a grey hairline down the landing page. A
      // clip-path is a hard raster clip that nothing paints through.
      // Horizontal only, for the same reason as the overflow above — a
      // full inset would clip a tall page vertically too.
      style={{ clipPath: 'inset(0 0 0 0)' }}
      data-active={active ? 'true' : 'false'}
      data-panel={name}
      inert={!active}
    >
      {children}
    </div>
  )
}
