import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, Timer, Users, ExternalLink } from 'lucide-react'

export default async function InstrumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const studiesQuery = supabase.from('studies').select('id, title')
  if (!isAdmin) studiesQuery.eq('created_by', user.id)
  const { data: studies } = await studiesQuery

  const studyIds = (studies ?? []).map((s: any) => s.id)
  const studyTitleMap = Object.fromEntries((studies ?? []).map((s: any) => [s.id, s.title]))

  // Query all instrument types directly — bypasses study_instruments RLS
  const [qRes, socRes, iatRes] = studyIds.length > 0
    ? await Promise.all([
        supabase.from('questionnaire_instruments').select('id, title, study_id, status, validated_scale_name, estimated_duration_minutes').in('study_id', studyIds).order('created_at', { ascending: false }),
        supabase.from('sociogram_instruments').select('id, title, study_id, min_nominations, max_nominations').in('study_id', studyIds).order('created_at', { ascending: false }),
        supabase.from('iat_instruments').select('id, title, study_id').in('study_id', studyIds).order('created_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  type Row = {
    id: string
    title: string
    study_id: string
    type: 'questionnaire' | 'sociogram' | 'iat'
    meta: string
    href: string
  }

  const all: Row[] = [
    ...(qRes.data ?? []).map((q: any) => ({
      id: q.id,
      title: q.title,
      study_id: q.study_id,
      type: 'questionnaire' as const,
      meta: [
        q.validated_scale_name,
        q.estimated_duration_minutes ? `~${q.estimated_duration_minutes} min` : null,
        q.status,
      ].filter(Boolean).join(' · '),
      href: `/studies/${q.study_id}/questionnaire/${q.id}`,
    })),
    ...(socRes.data ?? []).map((s: any) => ({
      id: s.id,
      title: s.title,
      study_id: s.study_id,
      type: 'sociogram' as const,
      meta: `${s.min_nominations}–${s.max_nominations} nominations`,
      href: `/studies/${s.study_id}/sociogram`,
    })),
    ...(iatRes.data ?? []).map((i: any) => ({
      id: i.id,
      title: i.title,
      study_id: i.study_id,
      type: 'iat' as const,
      meta: 'Death/Suicide IAT · ~12 min',
      href: `/studies/${i.study_id}/iat/${i.id}`,
    })),
  ]

  const typeAccent = { questionnaire: '#457B9D', sociogram: '#2D6A4F', iat: '#F4A261' }
  const typeIcon  = {
    questionnaire: ClipboardList,
    sociogram: Users,
    iat: Timer,
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground">Instruments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {all.length > 0
            ? `${all.length} instrument${all.length !== 1 ? 's' : ''} across ${studyIds.length} ${studyIds.length === 1 ? 'study' : 'studies'}`
            : 'No instruments yet.'}
        </p>
      </div>

      {all.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-serif text-xl text-foreground mb-2">No instruments yet.</p>
          <p className="text-sm italic text-muted-foreground">Add instruments inside a study to see them here.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {all.map(row => {
            const accent = typeAccent[row.type]
            const Icon   = typeIcon[row.type]
            return (
              <div
                key={row.id}
                className="flex items-center gap-4 py-3 border-b border-border last:border-0"
              >
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: accent }}
                />
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: accent + '18' }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{row.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">{studyTitleMap[row.study_id] ?? row.study_id}</span>
                    {row.meta && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">{row.meta}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize text-xs" style={{ borderColor: accent + '60', color: accent }}>
                  {row.type}
                </Badge>
                <Link
                  href={row.href}
                  className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0 px-1.5 py-1 rounded hover:bg-primary/5"
                >
                  Results <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
