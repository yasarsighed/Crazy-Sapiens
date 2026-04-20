import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/alerts  body: { participantId, questionnaireId }
// Acknowledges all unacknowledged alerts for a participant × questionnaire pair
export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Only researcher / admin may acknowledge
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['researcher', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { participantId, questionnaireId } = body

  if (!participantId || !questionnaireId) {
    return NextResponse.json({ error: 'participantId and questionnaireId required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('clinical_alerts_log')
    .update({
      acknowledged: true,
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('participant_id', participantId)
    .eq('questionnaire_id', questionnaireId)
    .eq('acknowledged', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
