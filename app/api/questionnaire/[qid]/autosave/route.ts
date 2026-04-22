import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// POST /api/questionnaire/[qid]/autosave
// Body: { itemId, rawValue }
// Upserts a single in-progress answer; does not mark complete.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ qid: string }> },
) {
  try {
    const { qid } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { itemId, rawValue } = await req.json()
    if (!itemId || rawValue === undefined) {
      return NextResponse.json({ error: 'itemId and rawValue required' }, { status: 400 })
    }

    const svc = createServiceClient()
    const row = {
      questionnaire_id: qid,
      participant_id: user.id,
      item_id: itemId,
      raw_response: String(rawValue),
      raw_response_numeric: Number(rawValue),
      scored_value: Number(rawValue),
      is_reverse_scored: false,
      is_skipped: false,
      clinical_flag_triggered: false,
      clinical_flag_message: null,
      submitted_at: new Date().toISOString(),
    }

    const { error } = await svc
      .from('questionnaire_item_responses')
      .upsert(row, { onConflict: 'questionnaire_id,participant_id,item_id' })

    if (error) {
      // Fall back: delete existing and insert
      await svc.from('questionnaire_item_responses')
        .delete()
        .eq('questionnaire_id', qid)
        .eq('participant_id', user.id)
        .eq('item_id', itemId)
      await svc.from('questionnaire_item_responses').insert(row)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
