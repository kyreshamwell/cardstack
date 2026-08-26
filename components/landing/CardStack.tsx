'use client'
// components/landing/CardStack.tsx
//
// The thing the product is named after, doing what the product does.
//
// Five cards in the app's own six-colour identity palette, ordered the way the
// dashboard orders them, highest utilization at the front. So it isn't
// decoration bolted onto a hero: it's the screen you get after signing up,
// compressed into one object, and it reads before any of the copy does.
//
// It went through a flat version first, where each card sat flush below the
// last. That renders as a table, not a stack. The overlap IS the idea, and it
// needs the cards to cover each other so the fan means something.
//
// Motion notes, since this is the piece carrying the page:
//   - Springs, never durations. Cards settle rather than arriving on a curve,
//     and staggering the springs makes the stack assemble instead of appear.
//   - The tilt tracks the pointer through a spring, so it lags the cursor
//     slightly. That lag is the effect: a transform wired straight to mouse
//     coordinates feels stuck to the glass.
//   - Hovering fans the stack open, which is the one interaction on the page
//     that rewards poking at it.
//   - Transform and opacity only, so all of it stays on the compositor.

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useRef, useState } from 'react'

interface StackCard {
  name: string
  bank: string
  mask: string
  balance: string
  utilization: number | null
  color: string
}

// The same cards the demo runs on, so the landing page previews the demo rather
// than inventing a second set of numbers that would drift from it.
const CARDS: StackCard[] = [
  { name: 'Double Cash', bank: 'Citi', mask: '7702', balance: '$0', utilization: 0, color: 'var(--s5)' },
  { name: 'Store Card', bank: 'Synchrony', mask: '••••', balance: '$289', utilization: null, color: 'var(--s4)' },
  { name: 'Quicksilver', bank: 'Capital One', mask: '2267', balance: '$612', utilization: 12, color: 'var(--s3)' },
  { name: 'Platinum', bank: 'American Express', mask: '4823', balance: '$2,180', utilization: 22, color: 'var(--s2)' },
  { name: 'Sapphire Preferred', bank: 'Chase', mask: '9141', balance: '$3,860', utilization: 77, color: 'var(--s1)' },
]

const CARD_W = 300
const CARD_H = 184
// The closed sliver is sized to clear the bank label AND the card name. At 44
// it sliced the names in half, which looks like a rendering bug rather than a
// stack. Whatever is visible has to be a complete thought.
const CLOSED = 56
const OPEN = 82 // fanned apart on hover

export function CardStack() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Pointer position normalised to -0.5…0.5 around the stack's centre.
  const px = useMotionValue(0)
  const py = useMotionValue(0)

  // The spring between pointer and transform is what gives the stack weight.
  const sx = useSpring(px, { stiffness: 140, damping: 20, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 140, damping: 20, mass: 0.6 })

  const rotateY = useTransform(sx, [-0.5, 0.5], [16, -16])
  const rotateX = useTransform(sy, [-0.5, 0.5], [-14, 14])

  const step = open && !reduce ? OPEN : CLOSED
  const stackHeight = CARD_H + step * (CARDS.length - 1)

  // Mouse events rather than pointer events: pointerenter doesn't fire for
  // every input path that produces a hover (synthesised mouse input included),
  // and the rest of this codebase already hovers on mouse events.
  function onMouseMove(e: React.MouseEvent) {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    // The fan opens on MOVEMENT, not on a separate enter event. Relying on
    // mouseenter left the stack shut for any input path that produces movement
    // without a clean enter, and movement is the more honest trigger anyway:
    // if the tilt is tracking you, the stack is under your cursor.
    if (!open) setOpen(true)
    px.set((e.clientX - box.left) / box.width - 0.5)
    py.set((e.clientY - box.top) / box.height - 0.5)
  }

  return (
    <div
      className="relative grid place-items-center"
      onMouseLeave={() => {
        setOpen(false)
        px.set(0)
        py.set(0)
      }}
      onMouseMove={reduce ? undefined : onMouseMove}
      ref={ref}
      // Perspective on the parent so all five cards share one vanishing point.
      // Set per-card, each would tilt in its own little world.
      style={{ perspective: 1400 }}
    >
      <motion.div
        animate={{ height: stackHeight }}
        className="relative"
        style={{
          rotateX: reduce ? 0 : rotateX,
          rotateY: reduce ? 0 : rotateY,
          transformStyle: 'preserve-3d',
          width: CARD_W,
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      >
        {CARDS.map((card, i) => (
          <motion.div
            animate={{ opacity: 1, y: i * step, scale: 1 }}
            className="absolute left-0 top-0 overflow-hidden rounded-2xl"
            initial={
              reduce
                ? { opacity: 1, y: i * CLOSED, scale: 1 }
                : { opacity: 0, y: i * CLOSED - 70, scale: 0.9 }
            }
            key={card.name}
            style={{
              background: card.color,
              boxShadow: '0 10px 30px -12px rgba(0,0,0,0.45)',
              height: CARD_H,
              // Depth in Z as well as Y, so the tilt reveals a real stack
              // rather than five coplanar rectangles.
              translateZ: i * 14,
              width: CARD_W,
              zIndex: i,
            }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    // Back cards land first and the front card lands last, so
                    // the stack builds toward the one you're meant to read.
                    damping: 24 + i,
                    delay: 0.05 * i,
                    mass: 0.85,
                    stiffness: 240,
                    type: 'spring',
                  }
            }
          >
            {/*
              A dark scrim over every card, not just the pale ones. The palette
              runs from a mid blue to an amber, and white text is unreadable on
              the amber without it. Scrimming only some cards would break the
              family resemblance, so all of them get it.
            */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(150deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.34) 55%, rgba(0,0,0,0.52) 100%)',
              }}
            />

            <div className="relative flex h-full flex-col justify-between p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/65">
                    {card.bank}
                  </p>
                  <p className="mt-0.5 truncate text-[15px] font-semibold leading-tight">
                    {card.name}
                  </p>
                </div>

                {card.utilization != null && (
                  <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tnum backdrop-blur-sm">
                    {card.utilization}%
                  </span>
                )}
              </div>

              {/* Only the front card shows a balance. The rest are covered to
                  roughly here anyway, and repeating it five times turns the
                  stack back into the list this replaced. */}
              <div className="flex items-end justify-between gap-3">
                <p className="font-mono text-xs tracking-[0.2em] text-white/70">
                  ···· {card.mask}
                </p>
                <p className="text-xl font-semibold tnum leading-none">{card.balance}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
