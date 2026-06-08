'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { RelativeTime } from '@/components/relative-time'
import { PageHeader } from '@/components/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus, ShieldAlert, Search, SortAsc, SortDesc,
  FlaskConical, Users, ArrowRight, Filter,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Study {
  id: string
  title: string
  description: string | null
  status: string
  created_at: string
  created_by: string
  creator_name?: string
  creator_color?: string
}

type SortKey = 'newest' | 'oldest' | 'title_asc' | 'title_desc'

const STATUS_OPTIONS = ['all', 'draft', 'active', 'paused', 'completed', 'archived']

function StudySkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-2/3 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-3/4 rounded" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-8 w-20 rounded-xl" />
      </div>
    </div>
  )
}

export default function StudiesPage() {
  const [studies,  setStudies]  = useState<Study[]>([])
  const [loading,  setLoading]  = useState(true)
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [query,    setQuery]    = useState('')
  const [status,   setStatus]   = useState('all')
  const [sort,     setSort]     = useState<SortKey>('newest')
  const [view,     setView]     = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const admin = profile?.role === 'admin'
      setIsAdmin(admin)

      let q = supabase.from('studies').select('*').order('created_at', { ascending: false })
      if (!admin) q = q.eq('created_by', user.id)
      const { data } = await q

      const list: Study[] = data || []

      if (admin && list.length > 0) {
        const ids = [...new Set(list.map(s => s.created_by))]
        const { data: creators } = await supabase.from('profiles').select('id, full_name, researcher_color').in('id', ids)
        const byId = Object.fromEntries((creators || []).map(c => [c.id, c]))
        list.forEach(s => {
          s.creator_name  = byId[s.created_by]?.full_name  ?? 'Unknown'
          s.creator_color = byId[s.created_by]?.researcher_color ?? '#6D28D9'
        })
      }

      setStudies(list)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let result = studies

    // Search
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (s.creator_name || '').toLowerCase().includes(q)
      )
    }

    // Status filter
    if (status !== 'all') result = result.filter(s => s.status === status)

    // Sort
    result = [...result].sort((a, b) => {
      if (sort === 'newest')     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'oldest')     return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'title_asc')  return a.title.localeCompare(b.title)
      if (sort === 'title_desc') return b.title.localeCompare(a.title)
      return 0
    })

    return result
  }, [studies, query, status, sort])

  const SORT_LABELS: Record<SortKey, string> = {
    newest: 'Newest first', oldest: 'Oldest first',
    title_asc: 'Title A→Z', title_desc: 'Title Z→A',
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <PageHeader
          title={isAdmin ? 'All Studies' : 'Your Studies'}
          subtitle={
            loading ? 'Loading…' :
            studies.length
              ? `${filtered.length} of ${studies.length} ${isAdmin ? 'studies' : 'experiments'}`
              : 'Science does not do itself.'
          }
          crumbs={[{ label: isAdmin ? 'All Studies' : 'Your Studies' }]}
          badge={isAdmin ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
              <ShieldAlert className="w-3 h-3" /> Admin
            </span>
          ) : undefined}
          actions={
            !isAdmin ? (
              <Button asChild size="sm" className="gap-1.5">
                <Link href="/studies/new">
                  <Plus className="w-3.5 h-3.5" /> New Study
                </Link>
              </Button>
            ) : undefined
          }
        />

        <div className="px-6 lg:px-8 py-6">
          {/* ── Search + filter bar ── */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search studies…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-9 text-sm h-9 rounded-xl"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all capitalize',
                    status === s
                      ? 'bg-foreground text-background border-foreground'
                      : 'text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
                  )}
                >
                  {s === 'all' ? `All (${studies.length})` : s}
                </button>
              ))}
            </div>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-xl text-xs">
                  {sort.includes('asc') || sort === 'oldest' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
                  {SORT_LABELS[sort]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground">Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                  <DropdownMenuItem key={k} onClick={() => setSort(k)} className={cn('text-xs gap-2', sort === k && 'font-semibold text-primary')}>
                    {SORT_LABELS[k]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View toggle */}
            <div className="flex items-center border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={cn('px-2.5 py-1.5 text-xs transition-colors', view === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
                title="Grid view"
              >⊞</button>
              <button
                onClick={() => setView('list')}
                className={cn('px-2.5 py-1.5 text-xs transition-colors', view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
                title="List view"
              >≡</button>
            </div>
          </div>

          {/* ── Results ── */}
          {loading ? (
            <div className={cn(view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3')}>
              {[1,2,3,4,5,6].map(n => <StudySkeleton key={n} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                {query || status !== 'all'
                  ? <Filter className="w-7 h-7 text-muted-foreground/40" />
                  : <FlaskConical className="w-7 h-7 text-muted-foreground/40" />
                }
              </div>
              <p className="font-serif text-xl text-foreground mb-2">
                {query || status !== 'all' ? 'No studies match your filters' : 'No studies yet'}
              </p>
              <p className="text-sm italic text-muted-foreground mb-6">
                {query || status !== 'all' ? 'Try clearing your search or filter.' : 'Science does not do itself.'}
              </p>
              {!isAdmin && !query && status === 'all' && (
                <Button asChild><Link href="/studies/new">Create your first study</Link></Button>
              )}
              {(query || status !== 'all') && (
                <Button variant="outline" onClick={() => { setQuery(''); setStatus('all') }}>Clear filters</Button>
              )}
            </div>
          ) : (
            <div className={cn(view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3')}>
              {filtered.map(study => (
                <div
                  key={study.id}
                  className={cn(
                    'group relative bg-card border border-border rounded-2xl overflow-hidden card-hover',
                    view === 'list' && 'flex items-center gap-4'
                  )}
                >
                  {/* Researcher color accent */}
                  <div
                    className={cn(view === 'grid' ? 'h-1 w-full' : 'w-1 h-full absolute left-0 top-0', 'shrink-0')}
                    style={{ backgroundColor: study.creator_color || '#6D28D9' }}
                  />

                  <div className={cn('p-5 flex-1', view === 'list' && 'flex items-center gap-4')}>
                    <div className={cn('flex-1 min-w-0', view === 'list' && 'flex items-center gap-4')}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-[15px] font-semibold text-foreground leading-snug line-clamp-2 flex-1">
                          {study.title}
                        </h3>
                        <StatusBadge status={study.status} className="shrink-0 ml-1" />
                      </div>

                      {study.description && view === 'grid' && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                          {study.description}
                        </p>
                      )}

                      <div className={cn('flex items-center gap-3 mt-3', view === 'list' && 'mt-0 ml-auto')}>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <RelativeTime date={study.created_at} className="text-[11px]" />
                        </div>
                        {isAdmin && study.creator_name && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span
                              className="w-3 h-3 rounded-full border border-border/50 shrink-0"
                              style={{ backgroundColor: study.creator_color }}
                            />
                            {study.creator_name}
                          </div>
                        )}
                        <Button asChild size="sm" className="ml-auto gap-1 rounded-xl text-xs h-7 px-3">
                          <Link href={`/studies/${study.id}`}>
                            {isAdmin ? 'View' : 'Manage'}
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
