import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { studyId } = await req.json()
  if (!studyId) return NextResponse.json({ error: 'studyId required' }, { status: 400 })

  // Gather all instrument IDs in this study
  const [qRes, socRes, iatRes] = await Promise.all([
    supabase.from('questionnaire_instruments').select('id').eq('study_id', studyId),
    supabase.from('sociogram_instruments').select('id').eq('study_id', studyId),
    supabase.from('iat_instruments').select('id').eq('study_id', studyId),
  ])

  const qIds  = (qRes.data  ?? []).map((r: any) => r.id)
  const socIds = (socRes.data ?? []).map((r: any) => r.id)
  const iatIds = (iatRes.data ?? []).map((r: any) => r.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deletes: any[] = []

  if (qIds.length > 0) {
    deletes.push(
      supabase.from('questionnaire_item_responses').delete()
        .eq('participant_id', user.id).in('questionnaire_id', qIds),
      supabase.from('questionnaire_scored_results').delete()
        .eq('participant_id', user.id).in('questionnaire_id', qIds),
    )
  }

  if (iatIds.length > 0) {
    deletes.push(
      supabase.from('iat_trial_log').delete()
        .eq('participant_id', user.id).in('iat_id', iatIds),
      supabase.from('iat_session_results').delete()
        .eq('participant_id', user.id).in('iat_id', iatIds),
    )
  }

  if (socIds.length > 0) {
    deletes.push(
      supabase.from('sociogram_participants').delete()
        .eq('participant_id', user.id).in('sociogram_id', socIds),
    )
  }

  deletes.push(
    supabase.from('clinical_alerts_log').delete()
      .eq('participant_id', user.id).eq('study_id', studyId),
  )

  await Promise.all(deletes)

  // Mark enrollment as withdrawn (status update only — column withdrawn_at may not exist)
  await supabase
    .from('study_enrollments')
    .update({ status: 'withdrawn' })
    .eq('study_id', studyId)
    .eq('participant_id', user.id)

  return NextResponse.json({ ok: true })
}
