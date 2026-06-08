'use client'

import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const main = document.querySelector('main') || window
    const handler = () => {
      const scrollY = main instanceof Window ? main.scrollY : (main as HTMLElement).scrollTop
      setVisible(scrollY > 400)
    }
    main.addEventListener('scroll', handler, { passive: true })
    return () => main.removeEventListener('scroll', handler)
  }, [])

  const scrollUp = () => {
    const main = document.querySelector('main') || window
    if (main instanceof Window) {
      main.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      (main as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <Button
      size="icon"
      variant="outline"
      onClick={scrollUp}
      aria-label="Scroll to top"
      className={cn(
        'fixed bottom-6 right-6 z-50 w-9 h-9 rounded-full shadow-md bg-card border-border transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <ArrowUp className="w-4 h-4" />
    </Button>
  )
}
