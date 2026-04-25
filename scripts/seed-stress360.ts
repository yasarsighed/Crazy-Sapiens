/**
 * scripts/seed-stress360.ts
 *
 * Creates 16 real participant accounts, enrolls them in the Stress360 study,
 * and generates plausible mock data for every instrument in that study
 * (questionnaires, IATs, sociogram).
 *
 * Run:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhb... \
 *   npx tsx scripts/seed-stress360.ts
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// ─── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PASSWORD      = '12345678'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.')
  process.exit(1)
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Participant list ──────────────────────────────────────────────────────────

const PARTICIPANTS = [
  { name: 'Deeya Kapadia',           email: 'kapadiadeeya@gmail.com',          occupation: 'Baby Intern' },
  { name: 'Hinal Makwana',           email: 'hinalmakwana01@gmail.com',         occupation: 'MA 1' },
  { name: 'Sharma Nandani Ritesh',   email: 'nandani.ritesh.sharma@gmail.com',  occupation: 'MA 1' },
  { name: 'Shraddha Mayuresh Dubaji',email: 'Shraddhadubaji@gmail.com',         occupation: 'MA 1' },
  { name: 'Prapti Sargara',          email: 'praptisargara@gmail.com',          occupation: 'MA 2' },
  { name: 'Bhumika Gehlot',          email: 'bhumikagehlot2002@gmail.com',      occupation: 'MA 2' },
  { name: 'Laxita Barot',            email: 'laxitabarot709@gmail.com',         occupation: 'MA 1' },
  { name: 'Krishna Joshi',           email: 'krishna06joshi@gmail.com',         occupation: 'Baby Intern' },
  { name: 'Grisha Vora',             email: 'grishavora5@gmail.com',            occupation: 'MA 1' },
  { name: 'Pooja Bharia',            email: 'bhariapoojaw@gmail.com',           occupation: 'MA 2' },
  { name: 'Harshi',                  email: 'work.psychintern@gmail.com',       occupation: 'MA 2' },
  { name: 'Ishika Bhandari',         email: 'ishikaempower@gmail.com',          occupation: 'Baby Intern' },
  { name: 'Ayushi Patel',            email: '1210ayushipatel@gmail.com',        occupation: 'MA 2' },
  { name: 'Devyani',                 email: 'devyanik0312@gmail.com',           occupation: 'MA 1' },
  { name: 'Vrinda Guru',             email: 'vrindaguru1225@gmail.com',         occupation: 'MA 1' },
  { name: 'Stutie Bidarkar',         email: 'Work.stutie13@gmail.com',          occupation: 'MA 2' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// Box-Muller normal variate
function randNormal(mean: number, sd: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function severityFromScore(scale: string | null, total: number, nItems: number, rMax: number): { label: string; category: string } {
  if (scale === 'PHQ-9') {
    if (total >= 20) return { label: 'Severe', category: 'severe' }
    if (total >= 15) return { label: 'Moderately Severe', category: 'moderately_severe' }
    if (total >= 10) return { label: 'Moderate', category: 'moderate' }
    if (total >= 5)  return { label: 'Mild', category: 'mild' }
    return { label: 'Minimal', category: 'minimal' }
  }
  if (scale === 'GAD-7') {
    if (total >= 15) return { label: 'Severe', category: 'severe' }
    if (total >= 10) return { label: 'Moderate', category: 'moderate' }
    if (total >= 5)  return { label: 'Mild', category: 'mild' }
    return { label: 'Minimal', category: 'minimal' }
  }
  if (scale === 'AAQ-II') {
    if (total >= 29) return { label: 'High Inflexibility', category: 'severe' }
    if (total >= 25) return { label: 'Elevated', category: 'moderate' }
    if (total >= 18) return { label: 'Average', category: 'mild' }
    return { label: 'Flexible', category: 'minimal' }
  }
  if (scale === 'MPFI') {
    if (total >= 37) return { label: 'High Inflexibility', category: 'severe' }
    if (total >= 25) return { label: 'Moderate', category: 'moderate' }
    return { label: 'Low Inflexibility', category: 'minimal' }
  }
  // Generic: use percentage of max possible
  const pct = total / (nItems * rMax)
  if (pct >= 0.70) return { label: 'High', category: 'severe' }
  if (pct >= 0.40) return { label: 'Moderate', category: 'moderate' }
  return { label: 'Low', category: 'minimal' }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Stress360 seed starting…\n')

  // ── Step 1: Create / resolve participant accounts ──────────────────────────
  console.log('── Step 1: Creating participant accounts ──')

  type Participant = { name: string; id: string; email: string; occupation: string }
  const participants: Participant[] = []

  // Pre-load existing profiles by email (auth.admin.listUsers has a platform-side bug)
  const allEmails = PARTICIPANTS.map(p => p.email)
  const { data: existingProfiles } = await svc
    .from('profiles')
    .select('id, email')
    .in('email', allEmails)
  const profileById = new Map((existingProfiles ?? []).map((p: any) => [p.email.toLowerCase(), p.id as string]))

  for (const p of PARTICIPANTS) {
    const existingId = profileById.get(p.email.toLowerCase())

    if (existingId) {
      participants.push({ ...p, id: existingId })
      console.log(`  ↩  ${p.name} (already exists)`)
      await svc.auth.admin.updateUserById(existingId, { password: PASSWORD, email_confirm: true })
      continue
    }

    const { data: created, error } = await svc.auth.admin.createUser({
      email: p.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: p.name, role: 'participant', occupation: p.occupation },
    })

    if (!error && created?.user) {
      participants.push({ ...p, id: created.user.id })
      console.log(`  ✓  ${p.name}`)
      // Ensure profile row exists (trigger may be absent)
      await svc.from('profiles').upsert(
        { id: created.user.id, email: p.email, full_name: p.name, role: 'participant', occupation: p.occupation },
        { onConflict: 'id' }
      )
      continue
    }

    console.error(`  ✗  ${p.name}: ${error?.message ?? 'unknown error'}`)
  }

  console.log(`\n  ${participants.length}/${PARTICIPANTS.length} participants ready.\n`)

  // ── Step 2: Find Stress360 study ───────────────────────────────────────────
  console.log('── Step 2: Locating Stress360 study ──')
  const { data: studies } = await svc.from('studies').select('id, title').ilike('title', '%stress%')
  if (!studies?.length) {
    console.error('  ✗ No study matching "stress" found. Create Stress360 first.')
    process.exit(1)
  }
  const study = studies[0]
  console.log(`  ✓ "${study.title}"  (${study.id})\n`)

  // ── Step 3: Enroll all participants ────────────────────────────────────────
  console.log('── Step 3: Enrolling participants ──')
  const now = new Date().toISOString()
  const enrollRows = participants.map(p => ({
    study_id:      study.id,
    participant_id: p.id,
    status:        'active',
    enrolled_at:   now,
    consented_at:  now,
  }))

  // upsert is safe to re-run
  const { error: enrollErr } = await svc
    .from('study_enrollments')
    .upsert(enrollRows, { onConflict: 'study_id,participant_id', ignoreDuplicates: true })

  if (enrollErr) console.error('  Enrollment error:', enrollErr.message)
  else console.log(`  ✓ ${enrollRows.length} enrollments saved.\n`)

  // ── Step 4: Discover instruments ───────────────────────────────────────────
  console.log('── Step 4: Discovering instruments ──')
  const [qRes, iatRes, socRes] = await Promise.all([
    svc.from('questionnaire_instruments').select('id, title, validated_scale_name').eq('study_id', study.id),
    svc.from('iat_instruments').select('id, title, iat_type').eq('study_id', study.id),
    svc.from('sociogram_instruments').select('id, title').eq('study_id', study.id),
  ])

  const questionnaires = qRes.data ?? []
  const iats           = iatRes.data ?? []
  const sociograms     = socRes.data ?? []

  console.log(`  Questionnaires : ${questionnaires.map(q => q.title).join(', ') || 'none'}`)
  console.log(`  IATs           : ${iats.map(i => i.title).join(', ') || 'none'}`)
  console.log(`  Sociograms     : ${sociograms.map(s => s.title).join(', ') || 'none'}\n`)

  // ── Step 5: Questionnaire mock data ───────────────────────────────────────
  for (const q of questionnaires) {
    console.log(`── Questionnaire: "${q.title}" (${q.validated_scale_name ?? 'custom'}) ──`)

    const { data: items } = await svc
      .from('questionnaire_items')
      .select('id, item_text, display_order, is_reverse_scored, scoring_weight, clinical_flag_threshold, clinical_flag_operator, is_clinical_flag_item')
      .eq('questionnaire_id', q.id)
      .eq('is_active', true)
      .order('display_order')

    if (!items?.length) { console.log('  ⚠ No items — skipping\n'); continue }

    // Scale-specific response distribution parameters
    const scale = q.validated_scale_name
    let rMin = 0, rMax = 3, mean = 1.2, sd = 0.8
    if (scale === 'AAQ-II') { rMin = 1; rMax = 7; mean = 3.2; sd = 1.5 }
    else if (scale === 'MPFI') { rMin = 1; rMax = 6; mean = 3.0; sd = 1.2 }
    else if (!scale)           { rMin = 1; rMax = 5; mean = 2.8; sd = 1.1 }

    let ok = 0
    for (const p of participants) {
      const submitAt = new Date(Date.now() - randInt(0, 7 * 24 * 3600 * 1000)).toISOString()
      const responseRecords: Record<string, unknown>[] = []
      let total = 0

      for (const item of items) {
        const raw = clamp(Math.round(randNormal(mean, sd)), rMin, rMax)
        const w   = (item.scoring_weight as number) ?? 1
        const scored = (item.is_reverse_scored ? (rMax + rMin - raw) : raw) * w
        total += scored

        // Clinical flag check
        const thr = item.clinical_flag_threshold as number | null
        const op  = item.clinical_flag_operator as string | null
        const flagged =
          item.is_clinical_flag_item && thr != null && op != null &&
          (op === 'gte' ? raw >= thr : op === 'lte' ? raw <= thr : raw === thr)

        responseRecords.push({
          questionnaire_id:      q.id,
          participant_id:        p.id,
          item_id:               item.id,
          raw_response:          String(raw),
          raw_response_numeric:  raw,
          scored_value:          scored,
          clinical_flag_triggered: flagged,
          clinical_flag_message: flagged ? 'Flag triggered (mock data)' : null,
          submitted_at:          submitAt,
        })
      }

      const { label: severityLabel, category: severityCategory } =
        severityFromScore(scale, total, items.length, rMax)

      // Upsert item responses
      const { error: rErr } = await svc
        .from('questionnaire_item_responses')
        .upsert(responseRecords, { onConflict: 'questionnaire_id,participant_id,item_id' })
      if (rErr && !rErr.code?.includes('23505')) {
        console.error(`  ✗ Response error (${p.name}): ${rErr.message}`)
        continue
      }

      // Upsert scored result
      const { error: sErr } = await svc
        .from('questionnaire_scored_results')
        .upsert({
          questionnaire_id:  q.id,
          participant_id:    p.id,
          total_score:       total,
          severity_label:    severityLabel,
          severity_category: severityCategory,
          is_complete:       true,
          submitted_at:      submitAt,
        }, { onConflict: 'questionnaire_id,participant_id' })
      if (sErr) { console.error(`  ✗ Score error (${p.name}): ${sErr.message}`); continue }

      ok++
    }
    console.log(`  ✓ ${ok}/${participants.length} submissions saved.\n`)
  }

  // ── Step 6: IAT mock data ─────────────────────────────────────────────────
  // Standard 7-block D2 structure (Greenwald, Nosek & Banaji 2003)
  const IAT_BLOCK_DEFS = [
    { num: 1, label: 'Category discrimination (practice)',     nTrials: 20, scored: false },
    { num: 2, label: 'Attribute discrimination (practice)',    nTrials: 20, scored: false },
    { num: 3, label: 'Combined A (practice)',                  nTrials: 20, scored: true  },
    { num: 4, label: 'Combined A (test)',                      nTrials: 40, scored: true  },
    { num: 5, label: 'Category discrimination reversed',       nTrials: 20, scored: false },
    { num: 6, label: 'Combined B (practice)',                  nTrials: 20, scored: true  },
    { num: 7, label: 'Combined B (test)',                      nTrials: 40, scored: true  },
  ]

  for (const iat of iats) {
    console.log(`── IAT: "${iat.title}" ──`)
    let ok = 0

    for (const p of participants) {
      // Check for existing session to avoid double-insert
      const { data: existing } = await svc
        .from('iat_session_results')
        .select('session_id')
        .eq('iat_id', iat.id)
        .eq('participant_id', p.id)
        .maybeSingle()
      if (existing) { ok++; continue }

      const sessionId     = randomUUID()
      const assignedOrder = Math.random() > 0.5 ? 'A' : 'B'
      // Realistic D-score: slightly positive (pro-life/self association) with variation
      const dScore = parseFloat(clamp(randNormal(0.18, 0.40), -1.2, 1.5).toFixed(3))

      const trialRows: Record<string, unknown>[] = []
      let trialN = 0

      for (const block of IAT_BLOCK_DEFS) {
        for (let t = 0; t < block.nTrials; t++) {
          trialN++
          const rtMs  = clamp(Math.round(randNormal(680, 170)), 150, 3000)
          const fast  = rtMs < 300
          const correct = !fast && Math.random() > 0.08
          trialRows.push({
            iat_id:               iat.id,
            participant_id:       p.id,
            session_id:           sessionId,
            block_number:         block.num,
            block_label:          block.label,
            block_type:           block.scored ? 'test' : 'practice',
            trial_number:         trialN,
            stimulus_text:        ['Me', 'My', 'I', 'Mine', 'Life', 'Alive', 'Living', 'Thrive'][randInt(0, 7)],
            stimulus_category:    (['concept_a', 'concept_b', 'attribute_a', 'attribute_b'] as const)[randInt(0, 3)],
            correct_key:          'e',
            pressed_key:          correct ? 'e' : 'i',
            response_time_ms:     rtMs,
            is_correct:           correct,
            is_too_fast:          fast,
            excluded_from_scoring: fast || !correct,
          })
        }
      }

      // Insert in batches of 100
      let failed = false
      for (let i = 0; i < trialRows.length; i += 100) {
        const { error } = await svc.from('iat_trial_log').insert(trialRows.slice(i, i + 100))
        if (error && !error.message?.includes('duplicate') && !error.message?.includes('unique')) {
          console.error(`  ✗ Trial insert (${p.name}): ${error.message}`)
          failed = true; break
        }
      }
      if (failed) continue

      // Insert session result — try with assigned_order, fall back without
      const sessionRow: Record<string, unknown> = {
        iat_id:         iat.id,
        participant_id: p.id,
        session_id:     sessionId,
        d_score:        dScore,
        computed_at:    new Date().toISOString(),
        assigned_order: assignedOrder,
      }
      let { error: sErr } = await svc.from('iat_session_results').insert(sessionRow)
      if (sErr?.message?.includes('assigned_order')) {
        delete sessionRow.assigned_order
        const retry = await svc.from('iat_session_results').insert(sessionRow)
        sErr = retry.error
      }
      if (sErr && !sErr.message?.includes('duplicate') && !sErr.message?.includes('unique')) {
        console.error(`  ✗ Session insert (${p.name}): ${sErr.message}`)
        continue
      }
      ok++
    }
    console.log(`  ✓ ${ok}/${participants.length} IAT sessions saved.\n`)
  }

  // ── Step 7: Sociogram mock data ────────────────────────────────────────────
  for (const soc of sociograms) {
    console.log(`── Sociogram: "${soc.title}" ──`)

    const { data: relTypes } = await svc
      .from('sociogram_relationship_types')
      .select('id, label, is_negative_dimension')
      .eq('sociogram_id', soc.id)
      .eq('is_active', true)
      .order('display_order')

    if (!relTypes?.length) { console.log('  ⚠ No relationship types — skipping\n'); continue }
    console.log(`  Relationship types: ${relTypes.map(r => r.label).join(', ')}`)

    // Register all participants as sociogram_participants
    const socPRows = participants.map(p => ({
      sociogram_id:      soc.id,
      participant_id:    p.id,
      display_name:      p.name,
      anonymised_label:  p.name,
      is_active:         true,
      has_submitted:     true,
      submitted_at:      now,
    }))
    const { error: spErr } = await svc
      .from('sociogram_participants')
      .upsert(socPRows, { onConflict: 'sociogram_id,participant_id' })
    if (spErr) console.error(`  ⚠ Participant register error: ${spErr.message}`)

    // Build nominations: each person nominates 4-8 others per relationship type
    const nominations: Record<string, unknown>[] = []
    for (const nominator of participants) {
      for (const rt of relTypes) {
        const pool = participants.filter(p => p.id !== nominator.id)
        const shuffled = [...pool].sort(() => Math.random() - 0.5)
        const count = randInt(4, Math.min(8, pool.length))

        for (const nominee of shuffled.slice(0, count)) {
          const score = rt.is_negative_dimension
            ? randInt(1, 3)   // low scores on negative ties
            : randInt(3, 5)   // positive ties scored higher
          nominations.push({
            sociogram_id:        soc.id,
            nominator_id:        nominator.id,
            nominee_id:          nominee.id,
            relationship_type_id: rt.id,
            score,
            is_negative_tie:     rt.is_negative_dimension,
            is_valid:            true,
            nomination_round:    1,
            submitted_at:        now,
          })
        }
      }
    }

    const { error: nomErr } = await svc
      .from('sociogram_nominations')
      .upsert(nominations, {
        onConflict: 'sociogram_id,nominator_id,nominee_id,relationship_type_id',
        ignoreDuplicates: true,
      })

    if (nomErr && !nomErr.message?.includes('unique') && !nomErr.message?.includes('42P10')) {
      console.error(`  ✗ Nomination error: ${nomErr.message}`)
    } else {
      console.log(`  ✓ ${nominations.length} nominations across ${relTypes.length} relationship type(s).\n`)
    }
  }

  console.log('═══════════════════════════════════════')
  console.log('✅  Seed complete.')
  console.log(`   ${participants.length} participants · ${questionnaires.length} questionnaire(s) · ${iats.length} IAT(s) · ${sociograms.length} sociogram(s)`)
  console.log('═══════════════════════════════════════')
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
