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
// opposite, so the two destinations sit on opposite sides and you always know
// which way you came from. Each is a full page in its own right.
//
// A drawer version of the auth panel was tried, where the landing page stayed
// on screen and squeezed to half width while the form opened beside it. It
// worked, but sign-in reads as a destination rather than something opened next
// to the pitch, so it went back to being its own panel.
//
// The AppShell around all of it (nav, brand, frame) never moves and never
// unmounts.
//
// Both panels stay mounted the whole time, which is the load-bearing decision
// here. Three earlier versions did not, and each failed differently:
//
//   1. Local state + history.pushState. The App Router remounts the route tree
//      when the URL is pushed underneath it, so the view reset to the landing
//      page every time: address bar on /demo, hero still on screen.
//   2. A cross-fade with AnimatePresence mode="wait". Correct, but it reads as
//      lag: 0.28s fading out, a dead beat, then 0.28s fading in. Nothing is
//      actually moving for most of the transition.
//   3. A slide with AnimatePresence mode="sync". In a Next LAYOUT the exiting
//      child cannot keep the old page's `children`; that prop has already
//      been replaced, so the panel sliding out re-rendered as the demo too,
//      and two dashboards crossed the screen. The usual fix freezes an
//      internal Next router context: a lot of fragility for one transition.
//
// Mounting both removes the entire class of problem. There is no enter, no
// exit and no unmount to coordinate, just one transform. It also means the
// demo is built and painted before it is ever asked for, so the slide has
// nothing to compile or mount mid-flight, which is most of why this now feels
// immediate rather than sluggish.
//
// The cost is that the routes' `children` go unused: the layout owns both
// panels, and the pages under it exist to own the URL, the metadata, and the
// signed-in redirect.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/dashboard/AppShell'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { PrivacyToggle } from '@/components/cards/PrivacyToggle'
import { LandingHero } from '@/components/landing/LandingHero'
import { AuthPanel } from '@/components/landing/AuthPanel'
import { DemoDashboard } from '@/components/demo/DemoDashboard'

// Order on the strip, left to right. The index is the whole routing rule.
const PANELS = ['demo', 'landing', 'auth'] as const
type PanelName = (typeof PANELS)[number]

// The width at which the layout stops being a phone and starts being the fixed
// desktop viewport. Kept in step with Tailwind's `xl:` prefix by hand, because
// the panels below need the same number in JS that the classes use in CSS.
const DESKTOP = '(min-width: 1280px)'

// `useLayoutEffect` warns when React renders on the server. The slide it drives
// only ever starts from a click, so on the server there is nothing to run.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

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
  // short and left a sliver of the neighbouring panel on screen, which is why
  // the demo's scrollbar was visible as a hairline down the left edge of the
  // landing page. The track is now container-width with panels that each
  // overflow it at 100%, so one step is exactly one panel with no rounding.
  //
  // Written so index 0 yields "0%" rather than "-0%": Motion accepts negative
  // zero and then never animates away from it.
  const offset = `${-index * 100}%`

  // A spring, not a duration. Easing curves make a transition feel scripted;
  // a spring settles, which is what makes it feel physical. Damped just short
  // of visible bounce: this carries a whole dashboard across the screen, and
  // overshoot at that size reads as a mistake rather than a flourish.
  const spring = { type: 'spring' as const, stiffness: 260, damping: 34, mass: 0.9 }

  // ── Making the slide work below xl ────────────────────────────────────────
  //
  // At rest on a phone only the ACTIVE panel is in flow (see Panel), because
  // all three contributing height would leave the short landing page with a
  // screenful of the dashboard's empty scroll underneath it. One panel in flow
  // means there is no strip to slide: translating by -100% per index would just
  // push the only visible panel off screen, which is why the CSS pinned the
  // track to `transform: none` and the transition was desktop-only.
  //
  // So the strip is now assembled for the duration of the move and taken apart
  // again afterwards:
  //
  //   1. scroll to the top, so collapsing the document height can't yank the
  //      content out from under the slide
  //   2. put every panel back in flow and pin the track to the height it can
  //      actually afford: one viewport, exactly what the desktop always has
  //   3. jump the track to where the OLD panel was, then spring to the new one
  //   4. on arrival, drop back to one panel in flow with the track at 0%, which
  //      is where the new panel already is on screen, so the teardown is
  //      invisible and normal document scrolling resumes
  //
  // Rest state is untouched by all of this, which is what keeps it safe: the
  // server renders exactly what it rendered before, `sliding` can only become
  // true after a click, and the phone still scrolls the document, not a box.
  const x = useMotionValue(offset)
  const trackRef = useRef<HTMLDivElement>(null)
  const [sliding, setSliding] = useState(false)
  const [lockHeight, setLockHeight] = useState<number | null>(null)
  // A ref as well as state, because a second click can arrive before React has
  // re-rendered the first one and the effect has to know it's already mid-move.
  const slidingRef = useRef(false)
  const prevIndex = useRef(index)

  useIsomorphicLayoutEffect(() => {
    const from = prevIndex.current
    if (from === index) return
    prevIndex.current = index

    if (reduce) {
      x.set(offset)
      return
    }

    // Desktop: all three panels are always in flow and the track is already
    // sitting at `from`. There is nothing to assemble, just move it.
    if (window.matchMedia(DESKTOP).matches) {
      const run = animate(x, offset, spring)
      return () => run.stop()
    }

    const track = trackRef.current
    if (!track) return

    // Only on the first step of a move. If a second click lands mid-flight the
    // track is already built and already carrying a transform, so re-jumping it
    // to `from` would snap backwards before setting off again.
    if (!slidingRef.current) {
      window.scrollTo(0, 0)
      // Measured after the scroll, so `top` is the un-scrolled offset: whatever
      // is left of the viewport below the nav.
      const top = track.getBoundingClientRect().top
      setLockHeight(Math.max(240, Math.round(window.innerHeight - top)))
      x.jump(`${-from * 100}%`)
    }
    slidingRef.current = true
    setSliding(true)

    const run = animate(x, offset, {
      ...spring,
      onComplete: () => {
        slidingRef.current = false
        setSliding(false)
        setLockHeight(null)
        x.jump('0%')
      },
    })
    return () => run.stop()
    // `spring` is a literal rebuilt every render and never changes; including it
    // would restart the animation on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, offset, reduce, x])

  return (
    <AppShell
      brandHref="/"
      navRight={
        /*
          Keyed, enter-only. An AnimatePresence here left the cluster stuck on
          the landing version. The exit never resolved, so the entering one
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
            of the whole site, not of the demo. It used to live only in the
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

          {/* On the auth panel the only useful move is back. A "Sign in"
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
        browser scrolls the container to it, which then stacks on top of the
        transform and leaves every later move one panel out.

        `clip` creates no scroll container, so there is nothing to scroll.
      */}
      {/*
        Horizontal clipping only below xl. `overflow-clip` on both axes makes
        these scroll containers, and a flex item that is a scroll container has
        `min-height: auto` resolve to 0, so instead of growing to fit a tall
        dashboard, the panel simply clipped it and the page stopped scrolling.
        The filmstrip only ever needs the horizontal axis clipped.
      */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-x-clip xl:block xl:h-full xl:flex-none xl:overflow-clip">
        <motion.div
          // `flex-1` below xl so the track fills whatever height main has, and
          // default `items-stretch` so the visible panel fills it in turn. A
          // percentage `min-h-full` on the panel can't do this: the track's
          // height is auto there, and a percentage against auto resolves to
          // nothing, which left the landing hero collapsed to its content and
          // parked at the top of a much taller screen.
          className="filmstrip-track flex flex-1 xl:h-full xl:flex-none"
          // Read by the CSS that pins the track at rest below xl. Only while
          // this says "true" is the transform below allowed to apply there.
          data-sliding={sliding ? 'true' : 'false'}
          ref={trackRef}
          // A motion value rather than `animate`, because below xl the move has
          // to be jumped to its starting offset in the same frame the strip is
          // assembled. Declarative `animate` would spring from wherever the
          // track was instead. No enter animation either way: on a cold load
          // the strip must already be at the right offset, or /demo would slide
          // in from nowhere on first paint.
          style={{
            x,
            willChange: 'transform',
            // Below xl, for the length of the move only: one viewport tall, so
            // an incoming dashboard three screens long can't stretch the
            // document mid-slide. `flex: none` because the `flex-1` above would
            // otherwise grow straight past it.
            ...(lockHeight != null ? { height: lockHeight, flex: 'none' } : null),
          }}
        >
          <Panel active={onDemo} name="demo" sliding={sliding}>
            <DemoDashboard now={now} />
          </Panel>
          <Panel active={panel === 'landing'} name="landing" sliding={sliding}>
            <LandingHero />
          </Panel>
          <Panel active={onAuth} name="auth" sliding={sliding}>
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
 * walk into a dashboard nobody can see, and the one that actually bit:
 * anything off-stage taking focus makes the browser scroll the strip to it.
 */
function Panel({
  active,
  children,
  name,
  sliding,
}: {
  active: boolean
  children: React.ReactNode
  name: string
  sliding: boolean
}) {
  return (
    <div
      // `overflow-clip` on each panel, not just on the track.
      //
      // The dashboard's scrolling regions use `-mx-1 px-1` to let their content
      // sit flush while the scrollbar hangs outside, which means they extend
      // 4px past the panel's own edge. The track clips at the container, but
      // the panel edge is one full viewport further along, so the demo's
      // right-most scrollbar was painting into the landing page as a hairline
      // down its left edge. Each panel now clips to itself. `clip` rather than
      // `hidden` so no scroll container is created here either.
      // Only the panel on screen contributes height. All three are mounted at
      // all times, so on a phone (where the document height IS the tallest
      // panel) an inactive dashboard would leave the landing page with a
      // screenful of empty scroll below it.
      //
      // The exception is `sliding`: during a move below xl every panel rejoins
      // the flow so there is a strip to translate, and the track pins itself to
      // one viewport for exactly as long as that lasts. Clipping goes to both
      // axes for the same window: the track's height is definite then, so this
      // can't hit the `min-height: auto` collapse that makes a scroll container
      // stop a page growing.
      className={`min-h-0 w-full shrink-0 xl:h-full xl:overflow-clip ${
        sliding ? 'overflow-clip' : 'overflow-x-clip'
      } ${active || sliding ? '' : 'hidden xl:block'}`}
      // Belt and braces with the overflow-clip above.
      //
      // The dashboard's scroll regions use `-mx-1 px-1` so their content sits
      // flush while the scrollbar hangs 4px OUTSIDE the box. Overflow clipping
      // is the correct fix and works, but scrollbar gutters are painted by the
      // compositor and have a history of surviving it, and the symptom is the
      // demo's scrollbar drawn as a grey hairline down the landing page. A
      // clip-path is a hard raster clip that nothing paints through.
      // Horizontal only, for the same reason as the overflow above: a
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
