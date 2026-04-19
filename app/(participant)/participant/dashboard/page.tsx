import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, CheckCircle, Clock, Users, Timer } from 'lucide-react'

export default async function ParticipantDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch active enrollments with study info
  const { data: enrollments } = await supabase
    .from('study_enrollments')
    .select('study_id, status')
    .eq('participant_id', user.id)
    .eq('status', 'active')

  const studyIds = enrollments?.map(e => e.study_id) ?? []

  // Fetch active questionnaires for enrolled studies
  const { data: questionnaires } = studyIds.length > 0
    ? await supabase
        .from('questionnaire_instruments')
        .select(
          'id, study_id, title, instructions, estimated_duration_minutes, validated_scale_name, status'
        )
        .in('study_id', studyIds)
        .eq('status', 'active')
    : { data: [] }

  // Fetch which questionnaires this participant has already completed
  const { data: completedResults } = await supabase
    .from('questionnaire_scored_results')
    .select('questionnaire_id')
    .eq('participant_id', user.id)
    .eq('is_complete', true)

  const completedIds = new Set(completedResults?.map(r => r.questionnaire_id) ?? [])

  const pending = questionnaires?.filter(q => !completedIds.has(q.id)) ?? []
  const completed = questionnaires?.filter(q => completedIds.has(q.id)) ?? []

  // Fetch sociograms for enrolled studies
  const { data: sociograms } = studyIds.length > 0
    ? await supabase
        .from('sociogram_instruments')
        .select('id, study_id, title, status')
        .in('study_id', studyIds)
        .eq('status', 'active')
    : { data: [] }

  // Check which sociograms this participant has already submitted
  const { data: submittedSociograms } = await supabase
    .from('sociogram_participants')
    .select('sociogram_id')
    .eq('participant_id', user.id)
    .eq('has_submitted', true)

  const submittedSociogramIds = new Set(submittedSociograms?.map(s => s.sociogram_id) ?? [])

  const pendingSociograms = sociograms?.filter(s => !submittedSociogramIds.has(s.id)) ?? []
  const completedSociograms = sociograms?.filter(s => submittedSociogramIds.has(s.id)) ?? []

  // Fetch IAT instruments directly from iat_instruments (same pattern as
  // questionnaire_instruments and sociogram_instruments — avoids RLS on study_instruments)
  const { data: iats } = studyIds.length > 0
    ? await supabase
        .from('iat_instruments')
        .select('id, study_id, title')
        .in('study_id', studyIds)
    : { data: [] }

  // Check which IATs this participant has already completed.
  // Query iat_trial_log — if any rows exist for this participant+instrument, it's done.
  const iatIds = (iats ?? []).map((i: any) => i.id)
  const { data: completedIatData } = iatIds.length > 0
    ? await supabase
        .from('iat_trial_log')
        .select('instrument_id')
        .eq('participant_id', user.id)
        .in('instrument_id', iatIds)
        .limit(iatIds.length)
    : { data: [] }

  // Fall back to checking iat_instrument_id column name if instrument_id returns nothing
  const completedIatIds = new Set(
    (completedIatData ?? []).map((r: any) => r.instrument_id ?? r.iat_instrument_id)
  )
  const pendingIats   = (iats ?? []).filter((i: any) => !completedIatIds.has(i.id))
  const completedIats = (iats ?? []).filter((i: any) =>  completedIatIds.has(i.id))

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground mb-1">Your instruments</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length + pendingSociograms.length + pendingIats.length > 0
            ? `${pending.length + pendingSociograms.length + pendingIats.length} pending. Take your time — there are no wrong answers.`
            : 'All done. Science thanks you.'}
        </p>
      </div>

      {/* Pending */}
      {(pending.length > 0 || pendingSociograms.length > 0 || pendingIats.length > 0) && (
        <div className="space-y-3 mb-8">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            To complete
          </h2>

          {/* Pending questionnaires */}
          {pending.map(q => (
            <div
              key={q.id}
              className="border border-border rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <ClipboardList className="w-4 h-4 text-[#457B9D] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{q.title}</p>
                  {q.validated_scale_name && (
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {q.validated_scale_name}
                    </Badge>
                  )}
                  {q.estimated_duration_minutes && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{q.estimated_duration_minutes} min
                    </p>
                  )}
                </div>
              </div>
              <Button asChild size="sm">
                <Link href={`/participant/questionnaire/${q.id}`}>Begin</Link>
              </Button>
            </div>
          ))}

          {/* Pending sociograms */}
          {pendingSociograms.map(s => (
            <div
              key={s.id}
              className="border border-border rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <Users className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                  <Badge variant="outline" className="text-[10px] mt-1">Sociogram</Badge>
                </div>
              </div>
              <Button asChild size="sm">
                <Link href={`/participant/sociogram/${s.id}`}>Begin</Link>
              </Button>
            </div>
          ))}

          {/* Pending IATs */}
          {pendingIats.map((iat: any) => (
            <div
              key={iat.id}
              className="border border-border rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <Timer className="w-4 h-4 text-[#F4A261] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{iat.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] border-[#F4A261] text-[#F4A261]">IAT</Badge>
                    {iat.estimated_duration_minutes && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        ~{iat.estimated_duration_minutes} min
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <Button asChild size="sm" className="bg-[#F4A261] hover:bg-[#e8934a] text-white border-0">
                <Link href={`/participant/iat/${iat.id}`}>Begin</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Completed */}
      {(completed.length > 0 || completedSociograms.length > 0 || completedIats.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Completed
          </h2>
          {completed.map(q => (
            <div
              key={q.id}
              className="border border-border rounded-xl p-4 flex items-center gap-3 opacity-60"
            >
              <CheckCircle className="w-4 h-4 text-[#52B788] shrink-0" />
              <p className="text-sm text-foreground">{q.title}</p>
              <Badge variant="outline" className="ml-auto text-[10px]">Done</Badge>
            </div>
          ))}
          {completedSociograms.map(s => (
            <div
              key={s.id}
              className="border border-border rounded-xl p-4 flex items-center gap-3 opacity-60"
            >
              <CheckCircle className="w-4 h-4 text-[#52B788] shrink-0" />
              <p className="text-sm text-foreground">{s.title}</p>
              <Badge variant="outline" className="ml-auto text-[10px]">Done</Badge>
            </div>
          ))}
          {completedIats.map((iat: any) => (
            <div
              key={iat.id}
              className="border border-border rounded-xl p-4 flex items-center gap-3 opacity-60"
            >
              <CheckCircle className="w-4 h-4 text-[#52B788] shrink-0" />
              <p className="text-sm text-foreground">{iat.title}</p>
              <Badge variant="outline" className="ml-auto text-[10px]">Done</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Not enrolled in anything */}
      {studyIds.length === 0 && pending.length === 0 && pendingSociograms.length === 0 && pendingIats.length === 0 && (
        <div className="text-center py-16">
          <p className="font-serif text-xl mb-2">You are not enrolled in any studies.</p>
          <p className="text-sm text-muted-foreground">
            Your researcher will send you an invitation link when you are added.
          </p>
        </div>
      )}
    </div>
  )
}
