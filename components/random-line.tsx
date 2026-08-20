'use client'

import { useEffect, useState } from 'react'

interface RandomLineProps {
  lines: string[]
  className?: string
}

// Same safe pattern as RandomGreeting: render lines[0] deterministically so
// the server and client's initial output match exactly, then swap in a
// random pick in an effect (after hydration has already succeeded) rather
// than calling Math.random() directly in a component's render output.
export function RandomLine({ lines, className }: RandomLineProps) {
  const [text, setText] = useState(lines[0])

  useEffect(() => {
    setText(lines[Math.floor(Math.random() * lines.length)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <p className={className}>{text}</p>
}
