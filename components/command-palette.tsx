'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  LayoutDashboard, FlaskConical, Users, FileText, BarChart3,
  Settings, Plus, Library, Database, ClipboardCheck,
  ClipboardList, UserCog, Shield, Brain, Search,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard',     href: '/dashboard',      icon: LayoutDashboard, group: 'Navigate',  shortcut: 'G D' },
  { label: 'Studies',       href: '/studies',         icon: FlaskConical,    group: 'Navigate',  shortcut: 'G S' },
  { label: 'Participants',  href: '/participants',    icon: Users,           group: 'Navigate',  shortcut: 'G P' },
  { label: 'Instruments',   href: '/instruments',     icon: FileText,        group: 'Navigate'                   },
  { label: 'Scale Library', href: '/scale-library',  icon: Library,         group: 'Navigate'                   },
  { label: 'Cohorts',       href: '/cohorts',         icon: Database,        group: 'Navigate'                   },
  { label: 'Analysis',      href: '/analysis',        icon: BarChart3,       group: 'Navigate'                   },
  { label: 'Supervisors',   href: '/supervisors',     icon: Shield,          group: 'Navigate'                   },
  { label: 'Requests',      href: '/admin/requests',  icon: ClipboardCheck,  group: 'Navigate'                   },
  { label: 'Audit Log',     href: '/audit-log',       icon: ClipboardList,   group: 'Navigate'                   },
  { label: 'Users',         href: '/users',            icon: UserCog,         group: 'Navigate'                   },
  { label: 'Settings',      href: '/settings',         icon: Settings,        group: 'Navigate',  shortcut: 'G ,' },
]

const ACTIONS = [
  { label: 'New Study',          href: '/studies/new',  icon: Plus,        group: 'Actions' },
  { label: 'Browse Scales',      href: '/scale-library',icon: Library,     group: 'Actions' },
  { label: 'View Analysis',      href: '/analysis',     icon: Brain,       group: 'Actions' },
]

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()

  const run = useCallback((href: string) => {
    onOpenChange(false)
    router.push(href)
  }, [onOpenChange, router])

  // Keyboard shortcut navigation (G+key combos)
  useEffect(() => {
    if (!open) return
    let gPressed = false
    let gTimer: ReturnType<typeof setTimeout>

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'g' || e.key === 'G') {
        gPressed = true
        clearTimeout(gTimer)
        gTimer = setTimeout(() => { gPressed = false }, 1000)
        return
      }
      if (!gPressed) return
      gPressed = false
      const shortcuts: Record<string, string> = {
        'd': '/dashboard', 's': '/studies', 'p': '/participants',
        ',': '/settings',
      }
      const dest = shortcuts[e.key.toLowerCase()]
      if (dest) run(dest)
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); clearTimeout(gTimer) }
  }, [open, run])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, studies, actions… (G + key to jump)" />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4 text-sm text-muted-foreground">
            <Search className="w-8 h-8 opacity-30" />
            <span>Nothing found. Try something else.</span>
          </div>
        </CommandEmpty>

        <CommandGroup heading="Actions">
          {ACTIONS.map(item => (
            <CommandItem key={item.href} onSelect={() => run(item.href)} className="gap-3">
              <item.icon className="w-4 h-4 text-primary" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map(item => (
            <CommandItem key={item.href} onSelect={() => run(item.href)} className="gap-3">
              <item.icon className="w-4 h-4 text-muted-foreground" />
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

// Hook to open/close and register Ctrl+K
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return { open, setOpen }
}
