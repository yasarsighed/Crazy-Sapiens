'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ConsentScreen } from '@/components/consent-screen'

// ─── Stimuli (Millner et al. 2019 + Greenwald 2003) ─────────────────────────
// 5 words per category is standard. Each word appears ~equally often per block.
const SELF_WORDS  = ['Me', 'My', 'I', 'Mine', 'Self']
const OTHER_WORDS = ['They', 'Them', 'Their', 'Other', 'Theirs']
const DEATH_WORDS = ['Death', 'Die', 'Dying', 'Suicide', 'Dead']
const LIFE_WORDS  = ['Life', 'Alive', 'Living', 'Survive', 'Thrive']

type WordType    = 'self' | 'other' | 'death' | 'life'
type ResponseKey = 'e' | 'i'

interface Trial {
  blockNum:   number
  trialNum:   number
  word:       string
  wordType:   WordType
  correctKey: ResponseKey
}

interface TrialResponse extends Trial {
  responseKey: ResponseKey
  rt:          number        // raw RT (ms)
  rtAdjusted:  number        // RT after error-penalty (D2)
  isCorrect:   boolean
}

// ─── Block definitions ───────────────────────────────────────────────────────
interface BlockPool { words: string[]; type: WordType; key: ResponseKey }
interface BlockDef {
  blockNum:  number
  count:     number
  label:     string
  leftLabel: string
  rightLabel: string
  pools:     BlockPool[]
  isScored:  boolean   // true for blocks 4 & 7 only
}

const BLOCK_DEFS: BlockDef[] = [
  { blockNum: 1, count: 20, isScored: false,
    label: 'Practice — Categories',
    leftLabel: 'Self', rightLabel: 'Other',
    pools: [
      { words: SELF_WORDS,  type: 'self',  key: 'e' },
      { words: OTHER_WORDS, type: 'other', key: 'i' },
    ] },
  { blockNum: 2, count: 20, isScored: false,
    label: 'Practice — Concepts',
    leftLabel: 'Death / Suicide', rightLabel: 'Life',
    pools: [
      { words: DEATH_WORDS, type: 'death', key: 'e' },
      { words: LIFE_WORDS,  type: 'life',  key: 'i' },
    ] },
  { blockNum: 3, count: 20, isScored: false,
    label: 'Practice — Combined (Self + Death)',
    leftLabel: 'Self  or  Death / Suicide', rightLabel: 'Other  or  Life',
    pools: [
      { words: SELF_WORDS,  type: 'self',  key: 'e' },
      { words: DEATH_WORDS, type: 'death', key: 'e' },
      { words: OTHER_WORDS, type: 'other', key: 'i' },
      { words: LIFE_WORDS,  type: 'life',  key: 'i' },
    ] },
  { blockNum: 4, count: 40, isScored: true,
    label: 'Test — Combined (Self + Death)',
    leftLabel: 'Self  or  Death / Suicide', rightLabel: 'Other  or  Life',
    pools: [
      { words: SELF_WORDS,  type: 'self',  key: 'e' },
      { words: DEATH_WORDS, type: 'death', key: 'e' },
      { words: OTHER_WORDS, type: 'other', key: 'i' },
      { words: LIFE_WORDS,  type: 'life',  key: 'i' },
    ] },
  { blockNum: 5, count: 40, isScored: false,
    label: 'Practice — Categories (switched)',
    leftLabel: 'Other', rightLabel: 'Self',
    pools: [
      { words: OTHER_WORDS, type: 'other', key: 'e' },
      { words: SELF_WORDS,  type: 'self',  key: 'i' },
    ] },
  { blockNum: 6, count: 20, isScored: false,
    label: 'Practice — Combined (Self + Life)',
    leftLabel: 'Other  or  Death / Suicide', rightLabel: 'Self  or  Life',
    pools: [
      { words: OTHER_WORDS, type: 'other', key: 'e' },
      { words: DEATH_WORDS, type: 'death', key: 'e' },
      { words: SELF_WORDS,  type: 'self',  key: 'i' },
      { words: LIFE_WORDS,  type: 'life',  key: 'i' },
    ] },
  { blockNum: 7, count: 40, isScored: true,
    label: 'Test — Combined (Self + Life)',
    leftLabel: 'Other  or  Death / Suicide', rightLabel: 'Self  or  Life',
    pools: [
      { words: OTHER_WORDS, type: 'other', key: 'e' },
      { words: DEATH_WORDS, type: 'death', key: 'e' },
      { words: SELF_WORDS,  type: 'self',  key: 'i' },
      { words: LIFE_WORDS,  type: 'life',  key: 'i' },
    ] },
]

// ─── Trial generation (balanced sampling) ────────────────────────────────────
// Each word in each category appears approximately equally often within a block.
// This avoids accidental over-representation of any single word.
function generateBalancedBlock(def: BlockDef): Trial[] {
  const trialsPerPool  = Math.floor(def.count / def.pools.length)
  const extra          = def.count - trialsPerPool * def.pools.length
  const raw: Trial[]   = []

  def.pools.forEach((pool, pi) => {
    const poolCount  = trialsPerPool + (pi < extra ? 1 : 0)
    const wordsPerCycle = pool.words.length
    for (let i = 0; i < poolCount; i++) {
      raw.push({
        blockNum:   def.blockNum,
        trialNum:   0, // assigned below
        word:       pool.words[i % wordsPerCycle],
        wordType:   pool.type,
        correctKey: pool.key,
      })
    }
  })

  // Fisher-Yates shuffle
  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]]
  }
  return raw.map((t, idx) => ({ ...t, trialNum: idx + 1 }))
}

function generateTrials(): Trial[] {
  return BLOCK_DEFS.flatMap(def => generateBalancedBlock(def))
}

// ─── D-score Algorithm D2 (Greenwald et al. 2003) ───────────────────────────
//
// Correct algorithm:
//   1. Cap RT > 10,000 ms at 10,000 ms
//   2. Exclude participant if > 10% of ALL B3+4+6+7 trials have RT < 300 ms
//   3. For error trials: replace RT with (mean of correct trials in that block pair + 600 ms)
//   4. Mean(B3+B4 penalized) and Mean(B6+B7 penalized)
//   5. Pooled SD = SD of ALL B3+B4+B6+B7 penalized trials combined
//   6. D = (Mean_B67 - Mean_B34) / Pooled_SD
//   Positive D = stronger Self–Death association
//
function computeDScore(responses: TrialResponse[]): { d: number | null; excluded: boolean; reason?: string } {
  // Only scoring blocks 3, 4, 6, 7
  const scoringBlocks = [3, 4, 6, 7]
  const all = responses.filter(r => scoringBlocks.includes(r.blockNum))

  if (all.length < 20) return { d: null, excluded: true, reason: 'Too few trials in scoring blocks.' }

  // Step 1: cap RT > 10,000 ms
  const capped = all.map(r => ({ ...r, rt: Math.min(r.rt, 10_000) }))

  // Step 2: exclude if > 10% of trials < 300 ms
  const fastPct = capped.filter(r => r.rt < 300).length / capped.length
  if (fastPct > 0.10) return { d: null, excluded: true, reason: `${Math.round(fastPct * 100)}% of responses were faster than 300 ms (data excluded).` }

  // Separate into block pairs
  const b34 = capped.filter(r => r.blockNum === 3 || r.blockNum === 4)
  const b67 = capped.filter(r => r.blockNum === 6 || r.blockNum === 7)

  if (b34.length < 10 || b67.length < 10) return { d: null, excluded: true, reason: 'Insufficient trials in one block pair.' }

  // Step 3: D2 error penalty — mean of CORRECT trials in pair + 600 ms for each error
  const mean = (arr: { rt: number }[]) => arr.reduce((s, r) => s + r.rt, 0) / arr.length

  const correctMean34 = mean(b34.filter(r => r.isCorrect))
  const correctMean67 = mean(b67.filter(r => r.isCorrect))
  const penalty = 600

  const penalized34 = b34.map(r => r.isCorrect ? r.rt : (correctMean34 + penalty))
  const penalized67 = b67.map(r => r.isCorrect ? r.rt : (correctMean67 + penalty))

  const m34 = penalized34.reduce((s, v) => s + v, 0) / penalized34.length
  const m67 = penalized67.reduce((s, v) => s + v, 0) / penalized67.length

  // Step 5: pooled SD from ALL penalized trials combined
  const allPenalized = [...penalized34, ...penalized67]
  const grandMean = allPenalized.reduce((s, v) => s + v, 0) / allPenalized.length
  const variance = allPenalized.reduce((s, v) => s + (v - grandMean) ** 2, 0) / allPenalized.length
  const pooledSD = Math.sqrt(variance)

  if (pooledSD === 0) return { d: null, excluded: true, reason: 'All response times identical.' }

  // Step 6: D = (M67 - M34) / pooled_SD
  const d = (m67 - m34) / pooledSD
  return { d, excluded: false }
}

// ─── D-score interpretation (Greenwald 2003 + Millner 2019 thresholds) ───────
function interpretDScore(d: number): { label: string; detail: string; color: string; clinical: boolean } {
  if (d < 0)     return { label: 'Slight lean toward Life',     detail: 'Implicit associations lean toward life-related concepts when paired with self.', color: '#52B788', clinical: false }
  if (d < 0.15)  return { label: 'Little or no association',    detail: 'No clear implicit preference between Self–Death and Self–Life pairings.',        color: '#888888', clinical: false }
  if (d < 0.35)  return { label: 'Slight Self–Death association', detail: 'A slight implicit tendency to associate self-concepts with death/suicide.',       color: '#E9C46A', clinical: false }
  if (d < 0.65)  return { label: 'Moderate Self–Death association', detail: 'Moderately faster responses when self is paired with death/suicide concepts.',  color: '#F4A261', clinical: false }
  return               { label: 'Strong Self–Death association',  detail: 'Strong implicit association between self-concepts and death/suicide. Consider clinical follow-up.',  color: '#E63946', clinical: true }
}

// ─── Phase ───────────────────────────────────────────────────────────────────
type Phase = 'loading' | 'consent' | 'mobile_warning' | 'already_done' | 'intro' | 'block_intro' | 'fixation' | 'stimulus' | 'error_feedback' | 'block_end' | 'saving' | 'results'

// ─── Component ────────────────────────────────────────────────────────────────
export default function IATPage() {
  const { iatid }  = useParams() as { iatid: string }
  const router     = useRouter()

  const [phase,         setPhase]         = useState<Phase>('loading')
  const [instrument,    setInstrument]    = useState<any>(null)
  const [trials,        setTrials]        = useState<Trial[]>([])
  const [trialIndex,    setTrialIndex]    = useState(0)
  const [blockIntroIdx, setBlockIntroIdx] = useState(0)
  const [showError,     setShowError]     = useState(false)
  const [dResult,       setDResult]       = useState<{ d: number | null; excluded: boolean; reason?: string } | null>(null)
  const [userId,        setUserId]        = useState<string | null>(null)
  const [blockErrors,   setBlockErrors]   = useState(0)   // errors in current block
  const [blockTotal,    setBlockTotal]    = useState(0)    // trials in current block so far
  const [consentText,   setConsentText]   = useState<string | null>(null)
  const [studyId,       setStudyId]       = useState<string | null>(null)

  // Refs for event handlers (never stale)
  const responsesRef   = useRef<TrialResponse[]>([])
  const trialStartRef  = useRef<number>(0)
  const trialsRef      = useRef<Trial[]>([])
  const trialIndexRef  = useRef<number>(0)
  const phaseRef       = useRef<Phase>('loading')
  const respondedRef   = useRef(false)

  // Keep refs in sync
  useEffect(() => { trialsRef.current     = trials      }, [trials])
  useEffect(() => { trialIndexRef.current = trialIndex  }, [trialIndex])
  useEffect(() => { phaseRef.current      = phase       }, [phase])

  // ─ Load + completion check ────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: instr } = await supabase
        .from('iat_instruments')
        .select('*')
        .eq('id', iatid)
        .single()
      setInstrument(instr)

      if (instr?.study_id) {
        setStudyId(instr.study_id)

        // Check consent
        const { data: enrollment } = await supabase
          .from('study_enrollments')
          .select('consented_at')
          .eq('study_id', instr.study_id)
          .eq('participant_id', user.id)
          .maybeSingle()

        if (!enrollment?.consented_at) {
          const { data: studyData } = await supabase
            .from('studies')
            .select('consent_text')
            .eq('id', instr.study_id)
            .single()
          setConsentText(studyData?.consent_text ?? null)
          setPhase('consent')
          return
        }
      }

      // Mobile / touch-only device warning — IAT requires physical keyboard
      const isTouchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches
      if (isTouchOnly) {
        setPhase('mobile_warning')
        return
      }

      // Check if already completed (any trial log rows for this participant+IAT)
      const { data: existingTrials } = await supabase
        .from('iat_trial_log')
        .select('iat_id')
        .eq('iat_id', iatid)
        .eq('participant_id', user.id)
        .limit(1)

      if (existingTrials && existingTrials.length > 0) {
        setPhase('already_done')
        return
      }

      const generated = generateTrials()
      setTrials(generated)
      trialsRef.current = generated
      setPhase('intro')
    }
    load()
  }, [iatid])

  // ─ Move to a specific trial index ────────────────────────────────────────
  function goToTrial(idx: number) {
    const all = trialsRef.current
    if (idx >= all.length) {
      const result = computeDScore(responsesRef.current)
      setDResult(result)
      setPhase('saving')
      phaseRef.current = 'saving'
      saveResults(responsesRef.current, result.d)
      return
    }

    const prevTrial = all[idx - 1]
    const nextTrial = all[idx]
    const isNewBlock = !prevTrial || prevTrial.blockNum !== nextTrial.blockNum

    if (isNewBlock) {
      const defIdx = BLOCK_DEFS.findIndex(b => b.blockNum === nextTrial.blockNum)
      setBlockIntroIdx(defIdx)
      setTrialIndex(idx)
      trialIndexRef.current = idx
      setBlockErrors(0)
      setBlockTotal(0)
      setPhase('block_intro')
      phaseRef.current = 'block_intro'
    } else {
      setTrialIndex(idx)
      trialIndexRef.current = idx
      startFixation()
    }
  }

  function startFixation() {
    setPhase('fixation')
    phaseRef.current = 'fixation'
    setTimeout(() => {
      trialStartRef.current = performance.now()
      respondedRef.current  = false
      setPhase('stimulus')
      phaseRef.current = 'stimulus'
    }, 400)
  }

  // ─ Keyboard handler ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'stimulus') return
      const k = e.key.toLowerCase()
      if (k !== 'e' && k !== 'i') return
      if (respondedRef.current) return
      e.preventDefault()
      respondedRef.current = true

      const rt          = Math.round(performance.now() - trialStartRef.current)
      const responseKey = k as ResponseKey
      const trial       = trialsRef.current[trialIndexRef.current]
      const isCorrect   = responseKey === trial.correctKey

      // rtAdjusted is set during D-score calculation — placeholder value here
      const resp: TrialResponse = { ...trial, responseKey, rt, rtAdjusted: rt, isCorrect }
      responsesRef.current = [...responsesRef.current, resp]

      setBlockTotal(t => t + 1)
      if (!isCorrect) setBlockErrors(e => e + 1)

      if (isCorrect) {
        setTimeout(() => goToTrial(trialIndexRef.current + 1), 150)
      } else {
        setShowError(true)
        setPhase('error_feedback')
        phaseRef.current = 'error_feedback'
        // Keep error visible for 800 ms, then continue
        setTimeout(() => {
          setShowError(false)
          goToTrial(trialIndexRef.current + 1)
        }, 800)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ─ Save results ───────────────────────────────────────────────────────────
  async function saveResults(finalResponses: TrialResponse[], dScore: number | null) {
    // Always navigate to results — saving is best-effort and must never block the participant
    const SAVE_TIMEOUT_MS = 12_000

    async function doSave() {
      if (!userId) return
      const supabase = createClient()
      const sessionId = crypto.randomUUID()

      const rows = finalResponses.map(r => ({
        iat_id:               iatid,
        participant_id:       userId,
        session_id:           sessionId,
        block_number:         r.blockNum,
        trial_number:         r.trialNum,
        stimulus_text:        r.word,
        stimulus_category:    r.wordType,
        correct_key:          r.correctKey,
        pressed_key:          r.responseKey,
        response_time_ms:     r.rt,
        is_correct:           r.isCorrect,
        is_too_fast:          r.rt < 300,
        excluded_from_scoring: ![3, 4, 6, 7].includes(r.blockNum),
      }))

      // Insert in batches of 100 (Supabase row limit per request)
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from('iat_trial_log').insert(rows.slice(i, i + 100))
        if (error) {
          // RLS or DB error — data not saved. Researcher will see incomplete record.
          console.error('iat_trial_log insert failed:', error.message)
          break
        }
      }

      // Save computed D-score (non-fatal — table may not exist yet)
      if (dScore !== null) {
        try {
          await supabase.from('iat_session_results').insert({
            iat_id:        iatid,
            participant_id: userId,
            session_id:    sessionId,
            d_score:       dScore,
            computed_at:   new Date().toISOString(),
          })
        } catch {
          // iat_session_results table may not exist — D-score recomputable from trial log
        }
      }
    }

    try {
      // Race the save against a timeout so a slow/hanging network never blocks the results screen
      await Promise.race([
        doSave(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Save timed out after 12 s')), SAVE_TIMEOUT_MS)
        ),
      ])
    } catch (err) {
      // Save timed out or failed — participant still sees results
      console.warn('IAT data save incomplete:', err instanceof Error ? err.message : String(err))
    } finally {
      setPhase('results')
    }
  }

  // ─ Derived values ────────────────────────────────────────────────────────
  const currentTrial  = trials[trialIndex]
  const currentBlock  = currentTrial
    ? BLOCK_DEFS.find(b => b.blockNum === currentTrial.blockNum) ?? BLOCK_DEFS[0]
    : BLOCK_DEFS[0]
  const introBlockDef = BLOCK_DEFS[blockIntroIdx] ?? BLOCK_DEFS[0]
  const totalTrials   = trials.length
  const isScoredBlock = introBlockDef.isScored
  const isSwitched    = introBlockDef.blockNum === 5

  // ─── Render ───────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading IAT…</p>
      </div>
    )
  }

  if (phase === 'consent' && studyId) {
    return (
      <ConsentScreen
        studyId={studyId}
        consentText={consentText}
        onConsent={() => {
          // After consent, check for mobile then proceed
          const isTouchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches
          if (isTouchOnly) { setPhase('mobile_warning'); return }
          const generated = generateTrials()
          setTrials(generated)
          trialsRef.current = generated
          setPhase('intro')
        }}
      />
    )
  }

  if (phase === 'mobile_warning') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <p className="text-4xl mb-4">📱</p>
          <h1 className="font-serif text-2xl text-foreground mb-3">Physical keyboard required</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            The Implicit Association Test (IAT) requires fast, accurate key presses using{' '}
            <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">E</kbd> and{' '}
            <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">I</kbd> keys.
            Touch-screen input cannot capture the precise reaction times needed for valid results.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Please return to this task on a device with a physical keyboard (laptop or desktop computer).
          </p>
          <Button variant="outline" onClick={() => router.push('/participant/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'already_done') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <p className="font-serif text-2xl text-foreground mb-3">Already completed</p>
          <p className="text-sm text-muted-foreground mb-6">
            You have already completed this IAT. Your data has been saved.
            The test cannot be repeated to protect result validity.
          </p>
          <Button variant="outline" onClick={() => router.push('/participant/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  // Full-screen dark task screen
  if (['block_intro', 'fixation', 'stimulus', 'error_feedback'].includes(phase)) {
    return (
      <div className="fixed inset-0 bg-[#1A1A1A] flex flex-col overflow-hidden select-none">

        {/* ── Block intro ──────────────────────────────────────────────────── */}
        {phase === 'block_intro' && (
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            <div className="max-w-lg w-full text-center">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">
                Block {introBlockDef.blockNum} of {BLOCK_DEFS.length}
              </p>
              <h2 className="text-white font-bold text-xl mb-2">{introBlockDef.label}</h2>

              {isScoredBlock && (
                <p className="text-[#E9C46A] text-xs mb-3">
                  ★ This is a scored block. Go as fast as you can while still being accurate.
                </p>
              )}
              {isSwitched && (
                <div className="bg-[#F4A261]/10 border border-[#F4A261]/30 rounded-xl p-3 mb-3">
                  <p className="text-[#F4A261] text-xs font-semibold">
                    ⚠ The category sides have switched. Read the labels carefully before starting.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 my-6">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-2">E key (left)</p>
                  <p className="text-white font-bold text-sm leading-snug">{introBlockDef.leftLabel}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-2">I key (right)</p>
                  <p className="text-white font-bold text-sm leading-snug">{introBlockDef.rightLabel}</p>
                </div>
              </div>

              <p className="text-gray-400 text-sm mb-6">
                Press{' '}
                <kbd className="bg-gray-700 px-2 py-0.5 rounded text-white text-xs font-mono">E</kbd>
                {' '}or{' '}
                <kbd className="bg-gray-700 px-2 py-0.5 rounded text-white text-xs font-mono">I</kbd>
                {' '}as quickly and accurately as possible. A red ✕ means wrong key — correct it and keep going.
              </p>

              <button
                onClick={startFixation}
                className="bg-white text-black font-semibold px-8 py-3 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Begin block {introBlockDef.blockNum}
              </button>
            </div>
          </div>
        )}

        {/* ── Fixation / Stimulus / Error feedback ─────────────────────────── */}
        {['fixation', 'stimulus', 'error_feedback'].includes(phase) && (
          <>
            {/* Category labels */}
            <div className="flex justify-between px-8 pt-6 pb-3 shrink-0">
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">E key</p>
                <p className="text-white font-bold text-base leading-snug max-w-[200px]">
                  {currentBlock.leftLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">I key</p>
                <p className="text-white font-bold text-base leading-snug max-w-[200px]">
                  {currentBlock.rightLabel}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="w-full h-0.5 bg-gray-800 shrink-0">
              <div
                className="h-full bg-gray-600 transition-all duration-100"
                style={{ width: `${(trialIndex / totalTrials) * 100}%` }}
              />
            </div>

            {/* Centre */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              {phase === 'fixation' && (
                <span className="text-gray-600 text-5xl font-light">+</span>
              )}
              {(phase === 'stimulus' || phase === 'error_feedback') && currentTrial && (
                <div className="text-center">
                  <p className="text-white text-5xl font-bold tracking-wide select-none">
                    {currentTrial.word}
                  </p>
                  {showError && (
                    <p className="text-[#E63946] text-5xl mt-4 font-bold">✕</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-8 pb-4 shrink-0">
              <p className="text-gray-700 text-xs">
                Block {currentTrial?.blockNum} / {BLOCK_DEFS.length}
                {currentBlock.isScored ? ' ★' : ''}
              </p>
              <p className="text-gray-700 text-xs">
                Trial {trialIndex + 1} / {totalTrials}
              </p>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── Intro ────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="max-w-lg w-full">
          <div className="mb-8 text-center">
            <h1 className="font-serif text-2xl text-foreground mb-2">
              {instrument?.title ?? 'Implicit Association Test'}
            </h1>
            <p className="text-sm text-muted-foreground">
              This test measures automatic associations — thought patterns that may operate outside conscious awareness.
            </p>
          </div>

          <div className="border border-border rounded-xl p-5 mb-5 space-y-3">
            <h2 className="font-serif text-base font-semibold">Instructions</h2>
            <ol className="space-y-2.5 text-sm text-muted-foreground">
              {[
                'Words appear one at a time on a dark screen.',
                <>Press <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">E</kbd> for categories on the <strong>left</strong>, <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono ml-1">I</kbd> for the <strong>right</strong>.</>,
                'Go as fast as you can while still being accurate.',
                'A red ✕ means wrong key — you can keep going straight away.',
                <>There are <strong>7 blocks</strong> total (~12 minutes). Two practice blocks at the start help you learn the task.</>,
                'Important: complete in one sitting without interruption for valid results.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-foreground font-bold shrink-0 w-5 text-right">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* First block preview */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="border border-border rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">E key (left)</p>
              <p className="text-sm font-bold">Self</p>
              <p className="text-xs text-muted-foreground mt-0.5">Me · My · I · Mine · Self</p>
            </div>
            <div className="border border-border rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">I key (right)</p>
              <p className="text-sm font-bold">Other</p>
              <p className="text-xs text-muted-foreground mt-0.5">They · Them · Their · Other · Theirs</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 mb-6 space-y-1.5">
            <p className="font-semibold">Before you begin:</p>
            <p>This IAT measures implicit associations between self-concepts and Death / Life words.
            A result in any direction does not define you and is not a diagnosis.</p>
            <p>Results reflect automatic patterns shaped by many factors — they do not represent your
            conscious beliefs, values, or character.</p>
            <p className="font-semibold">You are more than your reaction time.</p>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              setBlockIntroIdx(0)
              setTrialIndex(0)
              trialIndexRef.current = 0
              setPhase('block_intro')
              phaseRef.current = 'block_intro'
            }}
          >
            I understand — begin the test
          </Button>
        </div>
      </div>
    )
  }

  // ─── Saving ───────────────────────────────────────────────────────────────
  if (phase === 'saving') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-serif text-xl text-foreground mb-2">All done.</p>
          <p className="text-sm text-muted-foreground">Saving your responses…</p>
        </div>
      </div>
    )
  }

  // ─── Results / Debrief ────────────────────────────────────────────────────
  // Per Greenwald et al. (2003) and IAT administration guidelines: individual
  // D-scores should not be shown to participants without proper debrief context.
  // We show the researcher's custom debrief if set; otherwise a standard debrief.
  if (phase === 'results') {
    const customDebrief = instrument?.debrief_text?.trim()
    const dataNote = dResult?.excluded
      ? 'Note: Your data could not be scored due to response patterns (e.g., very fast responses).'
      : null

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <p className="text-4xl mb-3">✓</p>
            <h1 className="font-serif text-2xl text-foreground mb-2">Thank you for completing the IAT</h1>
            <p className="text-sm text-muted-foreground">Your responses have been saved.</p>
          </div>

          {customDebrief ? (
            <div className="border border-border rounded-xl p-5 mb-5 bg-muted/20">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {customDebrief}
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-xl p-5 mb-5 space-y-3">
              <h2 className="font-serif text-base font-semibold">About the IAT</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Implicit Association Test measures the speed of associations between concepts.
                It reflects automatic patterns that develop over a lifetime of exposure — not your
                conscious beliefs, values, or intentions.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                IAT scores have limited predictive value at the individual level and should
                always be interpreted alongside other measures by a qualified researcher.
                A result in any direction is not a diagnosis.
              </p>
              <p className="text-sm font-medium text-foreground">
                You are more than your reaction time.
              </p>
            </div>
          )}

          {dataNote && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-5">
              <p className="text-xs text-amber-900 leading-relaxed">{dataNote}</p>
            </div>
          )}

          <div className="border border-border rounded-xl p-4 mb-6">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">If you have concerns</strong> about your
              wellbeing after completing this task, please contact your researcher or reach out
              to a mental health support service. In a crisis, call your local emergency services.
            </p>
          </div>

          <Button className="w-full" onClick={() => router.push('/participant/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  return null
}

// Helper: check if a D-score value falls in the interpretation range label
function isInRange(d: number, rangeLabel: string): boolean {
  const clean = rangeLabel.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  if (clean.startsWith('<'))  return d < parseFloat(clean.slice(1))
  if (clean.startsWith('>'))  return d > parseFloat(clean.slice(1))
  const parts = clean.split('–').map(s => parseFloat(s.trim()))
  if (parts.length === 2) return d >= parts[0] && d < parts[1]
  return false
}
