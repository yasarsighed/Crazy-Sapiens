'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Clock, ClipboardList, Timer, Users, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface AuditActivityItem {
  id: string
  type: 'questionnaire' | 'iat' | 'sociogram' | 'alert'
  label: string
  sub: string
  timestamp: string
  color: string
  urgent?: boolean
}

const TYPE_FILTERS: Array<{ key: AuditActivityItem['type'] | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'alert', label: 'Alerts' },
  { key: 'questionnaire', label: 'Questionnaires' },
  { key: 'iat', label: 'IATs' },
  { key: 'sociogram', label: 'Sociograms' },
]

export function AuditLogFeed({
  activity,
  initialType,
}: {
  activity: AuditActivityItem[]
  // Lets links elsewhere in the app (the dashboard's alert button, the
  // notification bell) deep-link straight into the Alerts filter via
  // /audit-log?type=alert instead of dumping the researcher on an unfiltered
  // 77-event feed they then have to filter themselves.
  initialType?: AuditActivityItem['type']
}) {
  const [typeFilter, setTypeFilter] = useState<AuditActivityItem['type'] | 'all'>(initialType ?? 'all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return activity.filter(item => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      if (q && !item.label.toLowerCase().includes(q) && !item.sub.toLowerCase().includes(q)) return false
      return true
    })
  }, [activity, typeFilter, query])

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by participant or event…"
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={cn(
                'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors',
                typeFilter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground italic">No events match this filter.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(item => {
            const Icon =
              item.type === 'alert' ? AlertTriangle
              : item.type === 'questionnaire' ? ClipboardList
              : item.type === 'iat' ? Timer
              : Users

            return (
              <div
                key={item.id}
                className={`flex items-start gap-4 py-3 border-b border-border last:border-0 ${item.urgent ? 'bg-destructive/3 -mx-2 px-2 rounded-lg' : ''}`}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: item.color + '20' }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {item.urgent && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        needs review
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.timestamp
                    ? new Date(item.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4 italic text-center">
        Showing {filtered.length} of {activity.length} events (last 50 per category).
      </p>
    </div>
  )
}
