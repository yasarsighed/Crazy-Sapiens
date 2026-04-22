'use client'

import { useState } from 'react'
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
  ChevronDown,
  LogOut,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  profile: Profile | null
}

interface NavItem {
  href:    string
  label:   string
  icon:    typeof LayoutDashboard
  tooltip?:string | null
  stub?:   boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

// Dashboard stays pinned at the top; everything else grouped by intent.
const pinnedItem: NavItem = {
  href: '/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
  tooltip: 'The big picture',
}

const navGroups: NavGroup[] = [
  {
    title: 'Design',
    items: [
      { href: '/studies',       label: 'Studies',       icon: FlaskConical, tooltip: 'Your experiments' },
      { href: '/instruments',   label: 'Instruments',   icon: FileText },
      { href: '/scale-library', label: 'Scale library', icon: Library },
      { href: '/cohorts',       label: 'Cohorts',       icon: Database, tooltip: 'Participant pools' },
    ],
  },
  {
    title: 'Run',
    items: [
      { href: '/participants',    label: 'Participants',    icon: Users, tooltip: 'The brave ones' },
      { href: '/supervisors',     label: 'Supervisors',     icon: Shield },
      { href: '/admin/requests',  label: 'Requests',        icon: ClipboardCheck, tooltip: 'Cohort & study approval queue' },
    ],
  },
  {
    title: 'Analyse',
    items: [
      { href: '/analysis',      label: 'Analysis',      icon: BarChart3, tooltip: 'Cross-study statistics' },
      { href: '/audit-log',     label: 'Audit log',     icon: ClipboardList },
    ],
  },
]

const settingsNavItems: NavItem[] = [
  { href: '/users',    label: 'Users',    icon: UserCog },
  { href: '/settings', label: 'Settings', icon: Settings },
]

// Shared nav-link renders the active indicator, icon, label, and optional tooltip.
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
        'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors relative',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {isActive && (
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-l"
          style={{ backgroundColor: accentColor }}
        />
      )}
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
    </Link>
  )
  if (!item.tooltip) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{item.tooltip}</TooltipContent>
    </Tooltip>
  )
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const researcherColor = profile?.researcher_color || '#2D6A4F'

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="w-[210px] h-screen bg-card border-r border-border flex flex-col fixed left-0 top-0">
        {/* Logo area */}
        <div className="p-4 border-b border-border">
          <Logo size="sm" />
        </div>

        {/* Researcher avatar pill */}
        <Link href="/settings" className="block p-4 border-b border-border hover:bg-muted/40 transition-colors group">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name ?? 'Avatar'}
                className="w-9 h-9 rounded-full object-cover shrink-0 border border-border"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                style={{ backgroundColor: researcherColor }}
              >
                {getInitials(profile?.full_name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">
                {profile?.full_name || 'Researcher'}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {profile?.role || 'researcher'}
              </p>
            </div>
            <Settings className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
          </div>
        </Link>

        <nav className="flex-1 p-2 overflow-y-auto">
          <NavLink item={pinnedItem} pathname={pathname} accentColor={researcherColor} />

          {navGroups.map(group => (
            <div key={group.title} className="mt-4">
              <p className="px-3 mb-1 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavLink key={item.href} item={item} pathname={pathname} accentColor={researcherColor} />
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 px-3 py-2 w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-4"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', showAdvanced && 'rotate-180')} />
            <span>{showAdvanced ? 'Hide' : 'Admin & settings'}</span>
          </button>

          {showAdvanced && (
            <div className="space-y-0.5 pt-1">
              {settingsNavItems.map(item => (
                <NavLink key={item.href} item={item} pathname={pathname} accentColor={researcherColor} />
              ))}
            </div>
          )}
        </nav>

        {/* Sign out button */}
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground text-[13px]"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign out
          </Button>
        </div>

        {/* Copyright */}
        <div className="p-4 border-t border-border">
          <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
            &copy; 2026 Crazy Sapiens &mdash; Syed, Sharma &amp; Poddar &mdash; making research slightly less boring since 2026
          </p>
        </div>
      </aside>
    </TooltipProvider>
  )
}
