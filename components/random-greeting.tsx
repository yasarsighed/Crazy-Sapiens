'use client'

import { useEffect, useState } from 'react'

// Greetings — warm, but professional, with the odd wry one mixed in.
const GREETINGS: Array<(n: string) => string> = [
  (n) => `Welcome back, ${n}.`,
  (n) => `Good to see you, ${n}.`,
  (n) => `Ready when you are, ${n}.`,
  (n) => `Your studies are waiting, ${n}.`,
  (n) => `Let's get to work, ${n}.`,
  (n) => `Hope the research is going well, ${n}.`,
  (n) => `Back again, ${n}? The data missed you.`,
  (n) => `Statistically speaking, ${n}, today's a good day for science.`,
  (n) => `The IRB isn't watching, ${n}. Probably.`,
  (n) => `Outliers happen, ${n}. That's why we have you.`,
  (n) => `Another day, another dataset, ${n}.`,
  (n) => `Your sample size called, ${n}. It wants friends.`,
  (n) => `Confidence intervals don't build themselves, ${n}.`,
]

interface RandomGreetingProps {
  name: string
  /** A researcher-set custom greeting, if any — takes priority and stays fixed. */
  customGreeting?: string | null
  className?: string
}

// Picking the greeting with Math.random() directly in a Server Component
// (the previous approach) is unsafe: Next.js can re-render/revalidate that
// server output at unpredictable times (router-cache reconciliation,
// prefetch, back/forward navigation), and each re-render draws a different
// random value — which shows up as a real, recurring hydration-mismatch
// error (React #418) rather than a cosmetic one. Confirmed live: it fired
// on every re-visit to /dashboard once deployed.
//
// The fix is the standard one for any nondeterministic content under SSR:
// render a stable, deterministic value first (so the client's initial
// render matches the server's exactly) and swap in the random pick in an
// effect, which only runs after hydration has already succeeded.
export function RandomGreeting({ name, customGreeting, className }: RandomGreetingProps) {
  const stableDefault = customGreeting?.trim() || GREETINGS[0](name)
  const [text, setText] = useState(stableDefault)

  useEffect(() => {
    if (customGreeting?.trim()) return // researcher's own greeting stays fixed
    setText(GREETINGS[Math.floor(Math.random() * GREETINGS.length)](name))
    // Only re-roll if the underlying identity changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, customGreeting])

  return <h1 className={className}>{text}</h1>
}
