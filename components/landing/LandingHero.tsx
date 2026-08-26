'use client'
// components/landing/LandingHero.tsx
//
// The pitch: the centre panel of the filmstrip in MarketingFrame, with the
// demo one viewport to its left and sign-in one viewport to its right.
//
// Two-column: the argument on the left, the product on the right. The first
// version was a centred column of text over a feature row, which said nothing a
// hundred other pages don't and showed none of the one thing worth showing.
//
// The sequence matters more than any single effect. The headline types itself
// out, and only when it lands does everything under it rise in, so the page
// has a beginning and an end rather than one simultaneous arrival. Springs
// throughout, so nothing rides a rigid curve.
//
// Migrated off the old slate palette onto the semantic tokens at the same time:
// the demo it slides into is the real dashboard, and a slate hero handing over
// to a token-themed app would flash two different designs.

import Link from 'next/link'
import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { CardStack } from '@/components/landing/CardStack'
import { Typewriter } from '@/components/landing/Typewriter'

const HEADLINE = ['Every card.', 'One screen.']

export function LandingHero() {
  const reduce = useReducedMotion()
  // Everything below the headline waits for it. Held in state rather than a
  // fixed delay so the two can never drift apart if the copy changes length.
  const [typed, setTyped] = useState(false)

  const rise = {
    hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce
        ? { duration: 0 }
        : { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.7 },
    },
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="mx-auto grid h-full max-w-6xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16">

        {/* ── The argument ────────────────────────────────────────────────── */}
        <div className="max-w-xl">
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-3"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <motion.span
                animate={reduce ? undefined : { opacity: [0.9, 0, 0.9], scale: [1, 2.4, 1] }}
                className="absolute inset-0 rounded-full bg-good"
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
              />
              <span className="relative h-1.5 w-1.5 rounded-full bg-good" />
            </span>
            Live demo, no account needed
          </motion.p>

          <h1 className="mt-6 text-[clamp(2.5rem,5.2vw,4rem)] font-semibold tracking-tight leading-[1.02]">
            <Typewriter
              lineClassName={(i) => (i === 1 ? 'text-ink-3' : '')}
              lines={HEADLINE}
              onDone={() => setTyped(true)}
            />
          </h1>

          {/* Cued off the headline finishing, then staggered among themselves. */}
          <motion.div
            animate={typed ? 'show' : 'hidden'}
            initial="hidden"
            transition={{ staggerChildren: reduce ? 0 : 0.07 }}
            variants={{ hidden: {}, show: {} }}
          >
            <motion.p className="mt-6 max-w-md text-base text-ink-2 leading-relaxed" variants={rise}>
              Balances, utilization and due dates across every card you carry.
              Sorted by what actually moves your credit score, on a dashboard
              that never scrolls.
            </motion.p>

            <motion.div className="mt-9 flex flex-wrap items-center gap-3" variants={rise}>
              {/*
                Real Links, not buttons with state: these are genuine routes, so
                they prefetch, middle-click and copy, while the shared layout
                keeps the frame mounted, so following one slides rather than
                reloads.
              */}
              <motion.div whileHover={reduce ? undefined : { scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  className="flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-medium text-ground"
                  href="/demo"
                >
                  {/* Points left, because the demo is the panel to the left. */}
                  <motion.span
                    animate={reduce ? undefined : { x: [0, -4, 0] }}
                    aria-hidden="true"
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    ←
                  </motion.span>
                  See it running
                </Link>
              </motion.div>

              <motion.div whileHover={reduce ? undefined : { scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  className="flex items-center gap-2 rounded-xl border border-line px-6 py-3 text-sm font-medium text-ink-2 hover:bg-raised hover:text-ink transition-colors"
                  href="/sign-up"
                >
                  Create an account
                  {/* Points right, because auth is the panel to the right. */}
                  <span aria-hidden="true">→</span>
                </Link>
              </motion.div>
            </motion.div>

            <motion.p className="mt-5 text-xs text-ink-3" variants={rise}>
              The demo is the real dashboard on sample data: same components,
              same code. Nothing to install, nothing to connect.
            </motion.p>
          </motion.div>
        </div>

        {/* ── The product ─────────────────────────────────────────────────── */}
        <div className="hidden lg:block">
          <CardStack />
        </div>
      </div>
    </div>
  )
}
