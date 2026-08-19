'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, AlertTriangle, Activity, UserPlus, CheckCircle2, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: 'alert' | 'enrollment' | 'completion' | 'activity'
  message: string
  href: string
  createdAt: string
  read: boolean
}

function NotifIcon({ type }: { type: Notification['type'] }) {
  if (type === 'alert')      return <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#CE2029' }} />
  if (type === 'enrollment') return <UserPlus className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#86C99A' }} />
  if (type === 'completion') return <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#C6A8F0' }} />
  return <Activity className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#F0A65C' }} />
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const isAdmin = profile?.role === 'admin'

      // Clinical alerts (unacknowledged)
      const { data: alerts } = await supabase
        .from('clinical_alerts_log')
        .select('id, message, severity, created_at, participant_id')
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(5)

      // Recent activity
      const actQ = supabase.from('activity_logs').select('id, action_type, entity_type, created_at').order('created_at', { ascending: false }).limit(5)
      const { data: activity } = isAdmin ? await actQ : await actQ.eq('user_id', user.id)

      const notifs: Notification[] = [
        ...(alerts || []).map(a => ({
          id: `alert-${a.id}`,
          type: 'alert' as const,
          message: a.message || `Clinical alert for participant`,
          href: '/audit-log?type=alert',
          createdAt: a.created_at,
          read: false,
        })),
        ...(activity || []).map(a => ({
          id: `act-${a.id}`,
          type: (a.action_type === 'enrollment' ? 'enrollment' : a.action_type === 'completion' ? 'completion' : 'activity') as Notification['type'],
          message: `${a.action_type.replace(/_/g, ' ')} · ${a.entity_type.replace(/_/g, ' ')}`,
          href: '/audit-log',
          createdAt: a.created_at,
          read: true,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8)

      setNotifications(notifs)
      setUnread(notifs.filter(n => !n.read).length)
    }

    load()
    // Poll every 2 minutes
    const interval = setInterval(load, 120_000)
    return () => clearInterval(interval)
  }, [])

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 relative text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <Bell className="w-3.5 h-3.5" />
              {unread > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-destructive text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none border border-sidebar">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'Notifications'}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <p className="text-[10px] text-muted-foreground">{unread} unread</p>
            )}
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-[10px] text-primary hover:underline font-medium">
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All quiet. For now.</p>
            </div>
          ) : (
            notifications.map(n => (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
                  !n.read && 'bg-primary/[0.03]'
                )}
              >
                <NotifIcon type={n.type} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-[12px] text-foreground leading-snug line-clamp-2', !n.read && 'font-medium')}>
                    {n.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!n.read && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </Link>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2">
          <Link href="/audit-log" className="text-[11px] text-primary hover:underline font-medium" onClick={() => setOpen(false)}>
            View all activity →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
