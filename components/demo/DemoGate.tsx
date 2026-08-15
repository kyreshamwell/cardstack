'use client'
// components/demo/DemoGate.tsx
//
// Everything in the demo that would write to a real account.
//
// The buttons render exactly as they do in the app — same size, same position,
// same icons — because a toolbar with holes in it stops looking like the
// product. What changes is only what happens on click: instead of opening
// Plaid or deleting a row, they raise one shared prompt.
//
// One prompt, not one per button: several of these can be on screen at once,
// and a modal per button would let two open at the same time.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'

interface GateValue {
  /** Raises the prompt. `action` names the thing that needs a real account. */
  block: (action: string) => void
}

const GateContext = createContext<GateValue>({ block: () => {} })

export function useDemoGate() {
  return useContext(GateContext)
}

export function DemoGate({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState<string | null>(null)
  const reduce = useReducedMotion()

  // Portalled to <body>, and that is not optional here.
  //
  // The demo renders inside the marketing frame's animated wrapper, and a
  // transformed ancestor becomes the containing block for `position: fixed`
  // descendants. Left in place, the overlay laid itself out inside the
  // dashboard grid instead of the viewport and got clipped by the shell's
  // `overflow-hidden` — the prompt was visible but nothing in it could be
  // clicked, so neither "Keep exploring" nor the backdrop would dismiss it.
  //
  // Mounted-only because document doesn't exist during the server render.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Enter-only, with no AnimatePresence. Wrapping this in one left the overlay
  // pinned at its initial opacity of 0 and stopped it unmounting on dismiss —
  // the prompt was in the DOM, invisible, and swallowing nothing, so both
  // "Keep exploring" and the backdrop appeared dead. A modal that vanishes on
  // click instead of fading is a fair trade for one that reliably vanishes.
  const prompt = blocked ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
          >
            <button
              aria-label="Dismiss"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setBlocked(null)}
            />

            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-sm rounded-2xl border border-line bg-ground p-6 shadow-xl"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              role="dialog"
              transition={{ duration: reduce ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-base font-semibold text-ink">
                That one needs a real account
              </p>
              <p className="mt-2 text-sm text-ink-2 leading-relaxed">
                {blocked} works on your own cards, not the sample data. Everything
                else here is live — expand a card, click the chart, hide the
                balances.
              </p>
              <div className="mt-5 flex items-center gap-2">
                <Link
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-ground hover:opacity-90 transition-opacity"
                  href="/sign-up"
                >
                  Create an account
                </Link>
                <button
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:bg-raised hover:text-ink transition-colors"
                  onClick={() => setBlocked(null)}
                >
                  Keep exploring
                </button>
              </div>
            </motion.div>
          </motion.div>
  ) : null

  return (
    <GateContext.Provider value={{ block: setBlocked }}>
      {children}
      {mounted ? createPortal(prompt, document.body) : null}
    </GateContext.Provider>
  )
}

/**
 * A button that looks like a real one and raises the prompt instead of acting.
 * `action` is the phrase the prompt uses, so it reads as a sentence:
 * "Connecting a bank works on your own cards…".
 */
export function GatedButton({
  action,
  className,
  children,
  title,
}: {
  action: string
  className: string
  children: ReactNode
  title?: string
}) {
  const { block } = useDemoGate()
  return (
    <button className={className} onClick={() => block(action)} title={title}>
      {children}
    </button>
  )
}
