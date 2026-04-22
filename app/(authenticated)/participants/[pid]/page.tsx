import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardList, Timer, Users, AlertTriangle, Mail, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ pid: string }>
}) {
  const { pid } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: viewer } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = viewer?.role === 'admin'

  const { data: participant } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', pid)
    .single()

  if (!participant) notFound()

  // Studies this participant is enrolled in
  const { data: enrollments } = await supabase
    .from('study_enrollments')
    .select('id, study_id, status, enrolled_at, studies(id, title, status, created_by)')
    .eq('participant_id', pid)

  // Filter to studies this viewer can see
  const visible = (enrollments ?? []).filter((e: any) => {
    if (isAdmin) return true
    return e.studies?.created_by === user.id
  })

  const studyIds = visible.map((e: any) => e.study_id)

  // Pull all questionnaire results, IAT sessions, sociogram submissions
  const [qRes, iatRes, socRes, alertsRes] = await Promise.all([
    studyIds.length > 0
      ? supabase.from('questionnaire_scored_results')
          .select('id, questionnaire_id, total_score, severity_label, is_complete, completed_at, questionnaire_instruments(id, title, study_id)')
          .eq('participant_id', pid)
      : Promise.resolve({ data: [] as any[] }),
    studyIds.length > 0
      ? supabase.from('iat_session_results')
          .select('id, iat_id, d_score, created_at, iat_instruments(id, title, study_id)')
          .eq('participant_id', pid)
      : Promise.resolve({ data: [] as any[] }),
    studyIds.length > 0
      ? supabase.from('sociogram_participants')
          .select('id, sociogram_id, has_submitted, submitted_at, sociogram_instruments(id, title, study_id)')
          .eq('participant_id', pid)
      : Promise.resolve({ data: [] as any[] }),
    studyIds.length > 0
      ? supabase.from('clinical_alerts_log')
          .select('*')
          .eq('participant_id', pid)
          .in('study_id', studyIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ])

  const initials = (participant.full_name ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-8">
      <Link href="/participants" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to participants
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        {participant.avatar_url ? (
          <img src={participant.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border border-border" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium text-primary">
            {initials}
          </div>
        )}
        <div>
          <h1 className="font-serif text-2xl">{participant.full_name || 'Unnamed participant'}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <Mail className="w-3 h-3" /> {participant.email}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <Calendar className="w-3 h-3" />
            Joined {new Date(participant.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Demographics */}
      {(participant.date_of_birth || participant.gender || participant.education_level || participant.occupation) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="font-serif text-base">Demographics</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {participant.date_of_birth && (
              <div><p className="text-[10px] text-muted-foreground uppercase">DOB</p><p>{participant.date_of_birth}</p></div>
            )}
            {participant.gender && (
              <div><p className="text-[10px] text-muted-foreground uppercase">Gender</p><p>{participant.gender}</p></div>
            )}
            {participant.education_level && (
              <div><p className="text-[10px] text-muted-foreground uppercase">Education</p><p>{participant.education_level}</p></div>
            )}
            {participant.occupation && (
              <div><p className="text-[10px] text-muted-foreground uppercase">Occupation</p><p>{participant.occupation}</p></div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Studies */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="font-serif text-base">Enrolled studies ({visible.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Not enrolled in any visible studies.</p>
          ) : visible.map((e: any) => (
            <div key={e.id} className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/30">
              <div>
                <Link href={`/studies/${e.study_id}`} className="text-sm font-medium hover:text-primary">{e.studies?.title}</Link>
                <p className="text-[10px] text-muted-foreground">Enrolled {new Date(e.enrolled_at).toLocaleDateString()}</p>
              </div>
              <Badge variant={e.status === 'active' ? 'default' : 'secondary'} className="text-xs">{e.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Questionnaires */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#457B9D]" /> Questionnaire results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(qRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No questionnaire submissions.</p>
          ) : (qRes.data ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-md border border-border">
              <div>
                <Link
                  href={`/studies/${r.questionnaire_instruments?.study_id}/questionnaire/${r.questionnaire_id}/participant/${pid}`}
                  className="text-sm font-medium hover:text-primary"
                >
                  {r.questionnaire_instruments?.title || 'Untitled'}
                </Link>
                <p className="text-[10px] text-muted-foreground">
                  {r.is_complete ? 'Complete' : 'In progress'}
                  {r.completed_at && ` • ${new Date(r.completed_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{r.total_score}</p>
                {r.severity_label && <p className="text-[10px] text-muted-foreground">{r.severity_label}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* IAT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Timer className="w-4 h-4 text-[#F4A261]" /> IAT sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(iatRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No IAT sessions.</p>
          ) : (iatRes.data ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-md border border-border">
              <div>
                <Link
                  href={`/studies/${r.iat_instruments?.study_id}/iat/${r.iat_id}`}
                  className="text-sm font-medium hover:text-primary"
                >
                  {r.iat_instruments?.title || 'Untitled'}
                </Link>
                <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <p className="text-sm font-medium">D = {r.d_score?.toFixed(2) ?? '—'}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sociogram */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-[#2D6A4F]" /> Sociogram participation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(socRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No sociogram data.</p>
          ) : (socRes.data ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-md border border-border">
              <div>
                <Link
                  href={`/studies/${r.sociogram_instruments?.study_id}/sociogram`}
                  className="text-sm font-medium hover:text-primary"
                >
                  {r.sociogram_instruments?.title || 'Untitled'}
                </Link>
                <p className="text-[10px] text-muted-foreground">
                  {r.has_submitted ? `Submitted ${r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : ''}` : 'Not submitted'}
                </p>
              </div>
              <Badge variant={r.has_submitted ? 'default' : 'secondary'} className="text-xs">
                {r.has_submitted ? 'Done' : 'Pending'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Alerts */}
      {(alertsRes.data ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Clinical alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(alertsRes.data ?? []).map((a: any) => (
              <div key={a.id} className="p-3 rounded-md border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={a.severity === 'critical' ? 'destructive' : 'secondary'}
                    className="text-[10px] uppercase"
                  >
                    {a.severity}
                  </Badge>
                  {a.acknowledged && <span className="text-[10px] text-muted-foreground">Acknowledged</span>}
                  <span className="text-[10px] text-muted-foreground ml-auto">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs">{a.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
