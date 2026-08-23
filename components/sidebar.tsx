'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import {
  LayoutDashboard,
  FlaskConical,
  Users,
  FileText,
  BarChart3,
  Settings,
  UserCog,
  Shield,
  ClipboardList,
  Library,
  Database,
  ClipboardCheck,
  LogOut,
  ChevronRight,
  Sparkles,
  Brain,
  Search,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DarkModeToggle } from './dark-mode-toggle'
import { NotificationBell } from './notification-bell'

interface SidebarProps {
  profile: Profile | null
}

interface NavItem {
  href:    string
  label:   string
  icon:    typeof LayoutDashboard
  tooltip?: string | null
  badge?:  string
}

interface NavGroup {
  title:  string
  emoji:  string
  items:  NavItem[]
}

const pinnedItem: NavItem = {
  href:    '/dashboard',
  label:   'Dashboard',
  icon:    LayoutDashboard,
  tooltip: 'The big picture',
}

const navGroups: NavGroup[] = [
  {
    title: 'Design',
    emoji: '🎨',
    items: [
      { href: '/studies',       label: 'Studies',       icon: FlaskConical,  tooltip: 'Your experiments' },
      { href: '/instruments',   label: 'Instruments',   icon: FileText,      tooltip: 'Questionnaires, IATs & sociograms' },
      { href: '/scale-library', label: 'Scale Library', icon: Library,       tooltip: 'Validated psychological scales' },
      { href: '/cohorts',       label: 'Cohorts',       icon: Database,      tooltip: 'Participant pools' },
    ],
  },
  {
    title: 'Run',
    emoji: '🚀',
    items: [
      { href: '/participants',   label: 'Participants',  icon: Users,         tooltip: 'Everyone enrolled in your studies' },
      { href: '/supervisors',    label: 'Supervisors',   icon: Shield,        tooltip: 'Your oversight team' },
      { href: '/admin/requests', label: 'Requests',      icon: ClipboardCheck,tooltip: 'Cohort & study approval queue' },
    ],
  },
  {
    title: 'Analyse',
    emoji: '🔬',
    items: [
      { href: '/analysis',  label: 'Analysis',  icon: BarChart3,    tooltip: 'Cross-study statistics' },
      { href: '/audit-log', label: 'Audit Log', icon: ClipboardList, tooltip: 'Who did what, when' },
    ],
  },
]

const adminItems: NavItem[] = [
  { href: '/users',    label: 'Users',    icon: UserCog },
  { href: '/settings', label: 'Settings', icon: Settings },
]

// Role meta
const ROLE_META: Record<string, { label: string; emoji: string; color: string }> = {
  admin:      { label: 'Admin',      emoji: '⚡', color: '#7A1010' },
  supervisor: { label: 'Supervisor', emoji: '🔭', color: '#C6A8F0' },
  researcher: { label: 'Researcher', emoji: '🧪', color: 'var(--researcher-color)' },
}

// Footer notes — warm, but professional, with the occasional dry aside
// (researcher-only chrome — never anywhere near clinical data or the
// participant side, per the house style)
const QUIPS = [
  'built for rigorous, humane research',
  'your data, handled with care',
  'made with and for researchers',
  'clarity in, insight out',
  'good science, made a little easier',
  "p < .05 or it didn't happen",
  'reviewer 2 was unavailable for comment',
  'the null hypothesis never lets you down',
  'built on caffeine and confidence intervals',
  'correlation is not causation, but it is suspicious',
  'n=20 and a prayer',
]

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function NavLink({
  item,
  pathname,
  accentColor,
}: {
  item: NavItem
  pathname: string
  accentColor: string
}) {
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 relative',
        isActive
          ? 'font-bold text-white'
          : 'text-sidebar-foreground/95 hover:text-sidebar-foreground hover:bg-sidebar-accent',
      )}
      style={isActive ? { backgroundColor: accentColor } : undefined}
    >
      <Icon className={cn('w-4 h-4 shrink-0 transition-transform duration-150', 'group-hover:scale-110')} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="ml-auto text-[10px] font-bold bg-destructive text-white rounded-full px-1.5 py-0.5 leading-none">
          {item.badge}
        </span>
      )}
    </Link>
  )

  if (!item.tooltip) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs max-w-[180px]">
        {item.tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname   = usePathname()
  const router     = useRouter()
  const [showAdmin, setShowAdmin] = useState(false)
  const supabase   = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const role = profile?.role || 'researcher'
  const accentColor = role === 'admin'
    ? '#7A1010'
    : role === 'supervisor'
      ? '#C6A8F0'
      : (profile?.researcher_color || '#CE2029')

  const roleMeta = ROLE_META[role] || ROLE_META.researcher
  // Deterministic on the initial render (server and client must produce the
  // same output, or React throws a hydration-mismatch error — confirmed
  // live in production: an earlier version picked this randomly in the
  // initializer, which server-rendered one value and could hydrate a
  // different one). The random swap happens in an effect, which only runs
  // after hydration has already succeeded — same fix as RandomGreeting.
  const [quip, setQuip] = useState(QUIPS[0])
  useEffect(() => { setQuip(QUIPS[Math.floor(Math.random() * QUIPS.length)]) }, [])

  // Header background per role — flat warm colour, no gradients
  const headerBg =
    role === 'admin'
      ? '#7A1010'
      : role === 'supervisor'
        ? '#C6A8F0'
        : accentColor

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className="w-[240px] h-screen flex flex-col fixed left-0 top-0 z-40 bg-sidebar border-r border-sidebar-border"
        style={{ '--researcher-color': accentColor } as React.CSSProperties}
      >
        {/* ── Header: logo + role badge ── */}
        <div
          className="px-4 pt-5 pb-4 shrink-0"
          style={{ background: headerBg }}
        >
          <Logo size="sm" />
          <div className="mt-3 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white/90 bg-white/20 backdrop-blur-sm"
            >
              {roleMeta.emoji} {roleMeta.label}
            </span>
            {role === 'admin' && (
              <span className="text-[10px] text-white/60 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> Full Access
              </span>
            )}
          </div>
        </div>

        {/* ── User avatar / settings link ── */}
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-3 border-b border-sidebar-border hover:bg-sidebar-accent/50 transition-colors group shrink-0"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name ?? 'Avatar'}
              className="w-9 h-9 rounded-xl object-cover shrink-0 border-2 border-white shadow-sm"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
              style={{ background: accentColor }}
            >
              {getInitials(profile?.full_name ?? null)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-sidebar-foreground truncate leading-tight">
              {profile?.full_name || 'Researcher'}
            </p>
            <p className="text-[10px] text-sidebar-foreground/80 truncate">
              {profile?.email || 'No email'}
            </p>
          </div>
          <Settings className="w-3.5 h-3.5 text-sidebar-foreground/70 group-hover:text-sidebar-foreground transition-colors shrink-0" />
        </Link>

        {/* ── Navigation ── */}
        <nav className="flex-1 p-3 overflow-y-auto space-y-1">
          {/* Pinned dashboard */}
          <NavLink item={pinnedItem} pathname={pathname} accentColor={accentColor} />

          {/* Grouped nav */}
          {navGroups.map(group => (
            <div key={group.title} className="mt-4">
              <p className="section-label px-3 mb-1.5 flex items-center gap-1">
                <span className="text-base leading-none">{group.emoji}</span>
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavLink key={item.href} item={item} pathname={pathname} accentColor={accentColor} />
                ))}
              </div>
            </div>
          ))}

          {/* Admin & settings collapse */}
          <div className="mt-4">
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className="flex items-center gap-2 px-3 py-1.5 w-full text-[11px] text-sidebar-foreground/80 hover:text-sidebar-foreground/80 transition-colors rounded-lg hover:bg-sidebar-accent"
            >
              <ChevronRight className={cn('w-3 h-3 transition-transform duration-200', showAdmin && 'rotate-90')} />
              <span className="font-semibold tracking-wider uppercase">Admin & Settings</span>
            </button>
            {showAdmin && (
              <div className="space-y-0.5 mt-1 animate-slide-up">
                {adminItems.map(item => (
                  <NavLink key={item.href} item={item} pathname={pathname} accentColor={accentColor} />
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* ── Bottom tools: dark mode + notifications ── */}
        <div className="flex items-center gap-1 px-3 pb-2 pt-1 border-t border-sidebar-border shrink-0">
          <NotificationBell />
          <DarkModeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
                className="flex items-center gap-1.5 ml-auto px-2 py-1 rounded-lg text-[10px] text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors border border-sidebar-border/50"
              >
                <Search className="w-3 h-3" />
                <span>⌘K</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Command palette (Ctrl+K)</TooltipContent>
          </Tooltip>
        </div>

        {/* ── Sign out ── */}
        <div className="p-3 border-t border-sidebar-border shrink-0">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-sidebar-foreground/90 hover:bg-sidebar-accent transition-all duration-150 group"
          >
            <LogOut className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
            <span>Sign out</span>
          </button>
        </div>

        {/* ── Footer quip ── */}
        <div className="px-4 pb-4 shrink-0">
          <p className="text-[10px] text-sidebar-foreground/70 leading-relaxed italic">
            &copy; 2026 Crazy Sapiens &mdash; {quip}
          </p>
        </div>
      </aside>
    </TooltipProvider>
  )
}
