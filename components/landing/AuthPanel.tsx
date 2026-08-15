'use client'
// components/landing/AuthPanel.tsx
//
// The sign-in / sign-up form. No card, no columns — just the form, centred,
// with whitespace as its container.
//
// It deliberately has no pitch column of its own. Two versions tried one — a
// static two-column layout, then a drawer that squeezed the landing page beside
// it — and both were dropped: signing in is a destination, not something opened
// next to the pitch, and a second pitch column just duplicated the real one.
// This is the right-hand panel of the filmstrip in MarketingFrame.
//
// Built social-first. Google and Apple sit above the email form, because with
// three ways in, leading with a password implies the password is the main route
// when for most people it won't be. Clerk renders the provider buttons itself;
// `socialButtonsPlacement: 'top'` puts them above the form and globals.css
// styles them.
//
// Switching modes is a segmented control rather than a link buried under the
// form. They're one interface in two states, and the control says so.
//
// Clerk's forms are themed in globals.css against its stable `cl-*` classes.
// The `appearance` prop's `elements` map is NOT used — the root layout used to
// set one globally and it silently won over anything passed here. `layout`
// options below still work; only `elements` was the problem.
//
// Note on surfaces: every control sits on `raised` over a `ground` page, never
// the reverse. The two tokens don't hold a fixed relationship — `raised` is
// DARKER than `ground` in the light theme (#fafafa on #ffffff) and LIGHTER in
// the dark one (#0e0e0e on #000000) — so controls-on-ground read as raised in
// light and sunken in dark. This direction means "elevated" in both.

import { SignIn, SignUp } from '@clerk/nextjs'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

const clerkLayout = {
  layout: {
    // Providers above the email form — see the note at the top.
    socialButtonsPlacement: 'top' as const,
    // Drops first/last name from sign-up. They're optional, Clerk never
    // requires them, and two half-width fields labelled "Optional" were the
    // most cluttered thing on the form for no gain. The name can be collected
    // later, in the app, where it means something.
    showOptionalFields: false,
  },
}

const MODES = [
  { key: 'sign-in', href: '/sign-in', label: 'Sign in' },
  { key: 'sign-up', href: '/sign-up', label: 'Create account' },
] as const

export function AuthPanel({ active, mode }: { active: boolean; mode: 'sign-in' | 'sign-up' }) {
  const reduce = useReducedMotion()
  const isSignIn = mode === 'sign-in'

  // Clerk's form mounts only once this panel is the one on screen, and stays
  // mounted afterwards. Two reasons, one of them a bug:
  //
  //   - Clerk autofocuses its first field on mount. Mounted off-stage, that
  //     focus made the browser scroll the filmstrip sideways to reveal it, so
  //     the marketing page rendered with the sign-in form on screen.
  //   - It's the heaviest thing on the public side and most visitors never
  //     open it, so not mounting it keeps it off the landing page's path.
  const [everActive, setEverActive] = useState(active)
  useEffect(() => {
    if (active) setEverActive(true)
  }, [active])

  return (
    <div className="grid h-full w-full place-items-center overflow-y-auto px-6 py-8">
      <div className="w-full max-w-sm">

        {/* The switch itself stays instant — a pill sliding under the cursor
            was the part that felt laboured. The transition lives in the form
            below, which is the thing that actually changed. */}
        <div className="flex rounded-xl bg-raised p-1">
          {MODES.map((m) => {
            const selected = m.key === mode
            return (
              <Link
                aria-current={selected ? 'page' : undefined}
                className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                  selected ? 'bg-ground text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
                }`}
                href={m.href}
                key={m.key}
              >
                {m.label}
              </Link>
            )
          })}
        </div>

        {/*
          Keyed on mode, enter-only, and directional: Create account sits to the
          RIGHT of Sign in on the switch, so its form arrives from the right and
          Sign in's arrives from the left. Same left/right language the whole
          site moves in.

          Enter-only rather than AnimatePresence on purpose. Exits have failed
          to resolve twice in this codebase and left elements stranded; changing
          the key unmounts the old form outright, so there is no half-finished
          state to get stuck in.
        */}
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          initial={reduce ? false : { opacity: 0, x: isSignIn ? -24 : 24 }}
          key={mode}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }}
        >
        <div className="mt-7">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSignIn ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1.5 text-sm text-ink-2">
            {isSignIn
              ? 'Pick whichever way you signed up — they all reach the same cards.'
              : 'One account, and your cards follow it however you sign in.'}
          </p>
        </div>

        {/*
          Reserves roughly the height of two provider buttons plus the email
          step, so nothing jumps as Clerk mounts. Deliberately short of the
          tallest possible step — reserving for that left a slab of dead space
          under the button.
        */}
        <div className="mt-6 min-h-[190px]">
          {/*
            routing="virtual", not "path".

            Path routing makes Clerk assert it's mounted on a catch-all route
            matching its own `path`, and this form is mounted the whole time —
            including while the URL is `/`. That threw on every page load.
            Virtual routing is Clerk's mode for embedded forms: multi-step state
            lives in memory rather than the URL.

            The trade is that OAuth needs somewhere real to come back to, since
            there's no Clerk-owned path to return into — hence /sso-callback.
          */}
          {!everActive ? null : isSignIn ? (
            <SignIn
              appearance={clerkLayout}
              fallbackRedirectUrl="/dashboard"
              routing="virtual"
              signUpUrl="/sign-up"
            />
          ) : (
            <SignUp
              appearance={clerkLayout}
              fallbackRedirectUrl="/dashboard"
              routing="virtual"
              signInUrl="/sign-in"
            />
          )}
        </div>

        </motion.div>

        <p className="mt-7 border-t border-line pt-5 text-xs text-ink-3">
          Not ready?{' '}
          <Link className="text-ink-2 underline underline-offset-2 hover:text-ink" href="/demo">
            Try the demo instead
          </Link>{' '}
          — no account needed.
        </p>
      </div>
    </div>
  )
}
