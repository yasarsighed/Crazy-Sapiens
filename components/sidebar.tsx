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

const mainNavItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    tooltip: 'The big picture',
    stub: false,
  },
  {
    href: '/studies',
    label: 'Studies',
    icon: FlaskConical,
    tooltip: 'Your experiments',
    stub: false,
  },
  {
    href: '/participants',
    label: 'Participants',
    icon: Users,
    tooltip: 'The brave ones',
    stub: false,
  },
  {
    href: '/instruments',
    label: 'Instruments',
    icon: FileText,
    tooltip: null,
    stub: false,
  },
  {
    href: '/analysis',
    label: 'Analysis',
    icon: BarChart3,
    tooltip: 'Cross-study statistics',
    stub: false,
  },
]

const advancedNavItems = [
  { href: '/users',         label: 'Users',         icon: UserCog,     stub: false },
  { href: '/audit-log',     label: 'Audit Log',     icon: ClipboardList, stub: false },
  { href: '/scale-library', label: 'Scale Library', icon: Library,     stub: false },
  { href: '/supervisors',   label: 'Supervisors',   icon: Shield,      stub: false },
  { href: '/settings',      label: 'Settings',      icon: Settings,    stub: false },
]

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

        {/* Main navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors relative',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {isActive && (
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-l"
                    style={{ backgroundColor: researcherColor }}
                  />
                )}
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
              </Link>
            )

            if (item.tooltip) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {item.tooltip}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.href}>{linkContent}</div>
          })}

          {/* Advanced tools toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 px-3 py-2 w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-4"
          >
            <ChevronDown className={cn(
              'w-3 h-3 transition-transform',
              showAdvanced && 'rotate-180'
            )} />
            <span>{showAdvanced ? 'Hide' : 'Show'} advanced tools</span>
          </button>

          {/* Advanced navigation */}
          {showAdvanced && (
            <div className="space-y-1 pt-1">
              {advancedNavItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon

                if (item.stub) {
                  return (
                    <div
                      key={item.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-muted-foreground/50 cursor-not-allowed select-none"
                      title="Coming soon"
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[9px] border border-muted-foreground/30 rounded px-1 py-px">Soon</span>
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors relative',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {isActive && (
                      <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-l"
                        style={{ backgroundColor: researcherColor }}
                      />
                    )}
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
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
