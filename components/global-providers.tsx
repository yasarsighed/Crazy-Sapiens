'use client'

import { useState, useEffect } from 'react'
import { CommandPalette, useCommandPalette } from './command-palette'
import { KeyboardShortcuts } from './keyboard-shortcuts'
import { ScrollToTop } from './scroll-to-top'
import { TooltipProvider } from '@/components/ui/tooltip'

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useCommandPalette()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // '?' opens keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).isContentEditable) return
        e.preventDefault()
        setShortcutsOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Ctrl+N → new study
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        const tag = (e.target as HTMLElement).tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea') return
        e.preventDefault()
        window.location.href = '/studies/new'
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
      <KeyboardShortcuts open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ScrollToTop />
    </TooltipProvider>
  )
}
