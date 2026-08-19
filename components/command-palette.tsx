'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
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
  ClipboardList, UserCog, Shield, Brain, Search, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

interface StudyResult { id: string; title: string }
interface ParticipantResult { id: string; full_name: string | null; email: string | null }

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [studies, setStudies] = useState<StudyResult[]>([])
  const [participants, setParticipants] = useState<ParticipantResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const run = useCallback((href: string) => {
    onOpenChange(false)
    router.push(href)
  }, [onOpenChange, router])

  // shouldFilter={false} on the underlying Command (see ui/command.tsx) so
  // our async-loaded Studies/Participants items aren't at the mercy of cmdk's
  // built-in fuzzy filter, which only re-scans items present at mount time.
  // That means Actions/Navigate need their own simple substring filter here.
  const q = query.trim().toLowerCase()
  const filteredActions = q ? ACTIONS.filter(a => a.label.toLowerCase().includes(q)) : ACTIONS
  const filteredNav = q ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(q)) : NAV_ITEMS
  const noResults = q.length >= 2
    && !searching
    && studies.length === 0
    && participants.length === 0
    && filteredActions.length === 0
    && filteredNav.length === 0

  // Reset live-search results whenever the palette closes.
  useEffect(() => {
    if (!open) {
      setQuery('')
      setStudies([])
      setParticipants([])
    }
  }, [open])

  // Live search: studies + participants, scoped to what this viewer can see
  // (RLS on the underlying tables enforces the actual access boundary).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setStudies([])
      setParticipants([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      const [{ data: studyRows }, { data: participantRows }] = await Promise.all([
        supabase.from('studies').select('id, title').ilike('title', `%${q}%`).limit(5),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'participant')
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).limit(5),
      ])
      // Dedupe defensively — a participant matching both the name and email
      // ilike clauses in the OR filter should only ever appear once.
      setStudies([...new Map((studyRows ?? []).map(s => [s.id, s])).values()])
      setParticipants([...new Map((participantRows ?? []).map(p => [p.id, p])).values()])
      setSearching(false)
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

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
      <CommandInput
        placeholder="Search pages, studies, participants… (G + key to jump)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {noResults && (
          <div className="flex flex-col items-center gap-2 py-4 text-sm text-muted-foreground">
            <Search className="w-8 h-8 opacity-30" />
            <span>Nothing found. Try something else.</span>
          </div>
        )}

        {(studies.length > 0 || participants.length > 0 || (searching && q.length >= 2)) && (
          <>
            <CommandGroup heading="Studies">
              {searching && studies.length === 0 && (
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                </div>
              )}
              {studies.map(s => (
                <CommandItem key={s.id} onSelect={() => run(`/studies/${s.id}`)} className="gap-3">
                  <FlaskConical className="w-4 h-4 text-primary" />
                  <span className="truncate">{s.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {participants.length > 0 && (
              <CommandGroup heading="Participants">
                {participants.map(p => (
                  <CommandItem key={p.id} onSelect={() => run(`/participants/${p.id}`)} className="gap-3">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="truncate">{p.full_name || p.email || 'Unnamed participant'}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
          </>
        )}

        {filteredActions.length > 0 && (
          <CommandGroup heading="Actions">
            {filteredActions.map(item => (
              <CommandItem key={item.href} onSelect={() => run(item.href)} className="gap-3">
                <item.icon className="w-4 h-4 text-primary" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredActions.length > 0 && filteredNav.length > 0 && <CommandSeparator />}

        {filteredNav.length > 0 && (
        <CommandGroup heading="Navigate">
          {filteredNav.map(item => (
            <CommandItem key={item.href} onSelect={() => run(item.href)} className="gap-3">
              <item.icon className="w-4 h-4 text-muted-foreground" />
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        )}
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
