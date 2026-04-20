import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { studyId } = await req.json()
  if (!studyId) return NextResponse.json({ error: 'studyId required' }, { status: 400 })

  const { error } = await supabase
    .from('study_enrollments')
    .update({ consented_at: new Date().toISOString() })
    .eq('study_id', studyId)
    .eq('participant_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
