'use client'
// components/landing/Typewriter.tsx
//
// Types a headline out line by line, with a caret that sits where the next
// character will land.
//
// Two things it has to get right, both invisible when they work:
//
//   1. No layout shift. A naive typewriter grows its box one character at a
//      time and shoves everything below it down the page for a full second.
//      Each line here renders its FINAL text invisibly to hold the space, with
//      the typed prefix laid over the top — so the block is full size from the
//      first frame.
//   2. It reads as text. The animation is decoration; a screen reader gets the
//      finished headline from a single sr-only node and never sees the
//      half-typed states, which would otherwise be announced as they change.
//
// `prefers-reduced-motion` skips the whole thing and renders the finished
// headline — a caret blinking through a sentence is exactly the kind of motion
// that setting exists to turn off.

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

interface Props {
  lines: string[]
  /** Per-line class, so a headline can style its own second line. */
  lineClassName?: (index: number) => string
  /** Milliseconds per character. */
  speed?: number
  /** Pause before the first character. */
  startDelay?: number
  /** Beat between finishing one line and starting the next. */
  lineDelay?: number
  /** Fires once the last character lands — used to cue the rest of the page. */
  onDone?: () => void
}

export function Typewriter({
  lines,
  lineClassName,
  speed = 45,
  startDelay = 250,
  lineDelay = 260,
  onDone,
}: Props) {
  const reduce = useReducedMotion()
  const [count, setCount] = useState(0)
  const done = useRef(false)

  // Typed as one continuous string across all lines, then split back out. A
  // per-line counter needs its own index and its own completion check; a single
  // running total needs neither, and the line breaks fall out of the maths.
  const total = lines.reduce((n, line) => n + line.length, 0)

  // onDone is called from a timer, so it must not be a dependency — a parent
  // passing an inline arrow would otherwise restart the animation every render.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (reduce) {
      setCount(total)
      onDoneRef.current?.()
      return
    }

    let cancelled = false
    let typed = 0

    // Where each line ends in the combined string, so the gap between lines can
    // be paused on without tracking which line is active.
    const boundaries: number[] = []
    lines.reduce((n, line) => {
      const end = n + line.length
      boundaries.push(end)
      return end
    }, 0)

    function step() {
      if (cancelled) return

      typed += 1
      setCount(typed)

      if (typed >= total) {
        if (!done.current) {
          done.current = true
          onDoneRef.current?.()
        }
        return
      }

      const atLineEnd = boundaries.includes(typed)
      timer = window.setTimeout(step, atLineEnd ? lineDelay : speed)
    }

    let timer = window.setTimeout(step, startDelay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [lineDelay, lines, reduce, speed, startDelay, total])

  // Split the running count back into per-line prefixes.
  let remaining = count
  const shown = lines.map((line) => {
    const take = Math.max(0, Math.min(line.length, remaining))
    remaining -= take
    return line.slice(0, take)
  })

  const finished = count >= total
  // The caret belongs on the last line that has any text on it.
  const caretLine = shown.findIndex((text, i) => text.length < lines[i].length)

  return (
    <>
      {/* The real headline, for anything that reads rather than looks. */}
      <span className="sr-only">{lines.join(' ')}</span>

      <span aria-hidden="true">
        {lines.map((line, i) => (
          <span className={`relative block ${lineClassName?.(i) ?? ''}`} key={line}>
            {/* Sizer: holds the final width and height from frame one. */}
            <span className="invisible">{line}</span>

            <span className="absolute inset-0">
              {shown[i]}
              {!reduce && !finished && caretLine === i && (
                <span
                  className="caret-blink ml-0.5 inline-block h-[0.78em] w-[3px] translate-y-[0.06em] rounded-full align-middle"
                  style={{ background: 'var(--s1)' }}
                />
              )}
            </span>
          </span>
        ))}
      </span>
    </>
  )
}
