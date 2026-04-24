import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Clock, Users, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function InvitationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: actorProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = actorProfile?.role === 'admin'

  // Only active/draft/paused studies are relevant to outstanding invitations
  const studiesQuery = supabase.from('studies').select('id, title, status')
  if (!isAdmin) studiesQuery.eq('created_by', user.id)
  const { data: studies } = await studiesQuery.in('status', ['active', 'draft', 'paused'])

  const studyIds = (studies ?? []).map((s: any) => s.id)

  if (studyIds.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl">
        <h1 className="font-serif text-2xl mb-1">Invitations</h1>
        <p className="text-sm text-muted-foreground mb-12">Who you've summoned into the arena.</p>
        <div className="text-center py-24">
          <p className="font-serif text-xl mb-2">No active studies yet.</p>
          <p className="text-sm italic text-muted-foreground">
            Create a study first, then add participants.
          </p>
        </div>
      </div>
    )
  }

  const [enrollmentsRes, qInstrumentsRes] = await Promise.all([
    supabase
      .from('study_enrollments')
      .select('id, participant_id, study_id, status, enrolled_at')
      .in('study_id', studyIds)
      .order('enrolled_at', { ascending: false }),
    supabase
      .from('questionnaire_instruments')
      .select('id, study_id')
      .in('study_id', studyIds),
  ])

  const enrollments = enrollmentsRes.data ?? []
  const participantIds = [...new Set(enrollments.map((e: any) => e.participant_id))]

  // Fetch participant profiles
  const { data: profiles } = participantIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', participantIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
  const studyMap = Object.fromEntries((studies ?? []).map((s: any) => [s.id, s]))

  // Determine which participants have at least one scored questionnaire result
  const qIds = (qInstrumentsRes.data ?? []).map((q: any) => q.id)
  let completedParticipantIds = new Set<string>()
  if (qIds.length > 0 && participantIds.length > 0) {
    const { data: completed } = await supabase
      .from('questionnaire_scored_results')
      .select('participant_id')
      .in('participant_id', participantIds)
      .in('questionnaire_id', qIds)
    for (const c of completed ?? []) {
      completedParticipantIds.add(c.participant_id)
    }
  }

  // Group enrollments by study
  const byStudy: Record<string, any[]> = {}
  for (const e of enrollments) {
    if (!byStudy[e.study_id]) byStudy[e.study_id] = []
    byStudy[e.study_id].push(e)
  }

  const totalEnrolled = enrollments.length
  const totalPending = enrollments.filter(
    (e: any) => e.status !== 'withdrawn' && !completedParticipantIds.has(e.participant_id),
  ).length
  const totalDone = enrollments.filter((e: any) => completedParticipantIds.has(e.participant_id)).length

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-serif text-2xl mb-1">Invitations</h1>
        <p className="text-sm text-muted-foreground">
          Who you&apos;ve summoned into the arena.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-2xl font-serif font-semibold">{totalEnrolled}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total invited</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#E9C46A]" />
              <p className="text-2xl font-serif font-semibold text-[#E9C46A]">{totalPending}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#52B788]" />
              <p className="text-2xl font-serif font-semibold text-[#52B788]">{totalDone}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      {totalEnrolled === 0 ? (
        <div className="text-center py-24">
          <p className="font-serif text-xl mb-2">No participants enrolled yet.</p>
          <p className="text-sm italic text-muted-foreground">
            Go to your{' '}
            <Link href="/studies" className="text-primary hover:underline">
              studies
            </Link>{' '}
            to add participants.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(studies ?? []).map((study: any) => {
            const rows = byStudy[study.id] ?? []
            if (rows.length === 0) return null

            const pendingCount = rows.filter(
              (e: any) =>
                e.status !== 'withdrawn' && !completedParticipantIds.has(e.participant_id),
            ).length

            return (
              <Card key={study.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-serif text-base">
                      <Link
                        href={`/studies/${study.id}`}
                        className="hover:underline"
                      >
                        {study.title}
                      </Link>
                    </CardTitle>
                    {pendingCount > 0 && (
                      <Badge variant="outline" className="text-xs shrink-0 text-[#E9C46A] border-[#E9C46A]">
                        {pendingCount} pending
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-border">
                    {rows.map((enrollment: any) => {
                      const p = profileMap[enrollment.participant_id]
                      const done = completedParticipantIds.has(enrollment.participant_id)
                      const withdrawn = enrollment.status === 'withdrawn'

                      return (
                        <div
                          key={enrollment.id}
                          className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                        >
                          {done ? (
                            <CheckCircle className="w-4 h-4 text-[#52B788] shrink-0" />
                          ) : withdrawn ? (
                            <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-[#E9C46A] shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {p?.full_name ?? '—'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {p?.email ?? enrollment.participant_id}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className={
                                done
                                  ? 'text-[#52B788] border-[#52B788] text-xs'
                                  : withdrawn
                                    ? 'text-muted-foreground text-xs'
                                    : 'text-[#E9C46A] border-[#E9C46A] text-xs'
                              }
                            >
                              {done ? 'Completed' : withdrawn ? 'Withdrawn' : 'Pending'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {enrollment.enrolled_at
                                ? new Date(enrollment.enrolled_at).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
