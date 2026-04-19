'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

// ─── Stimuli (Millner et al. 2019 + Greenwald 2003) ─────────────────────────
const SELF_WORDS  = ['Me', 'My', 'I', 'Mine', 'Self']
const OTHER_WORDS = ['They', 'Them', 'Their', 'Other', 'Theirs']
const DEATH_WORDS = ['Death', 'Die', 'Dying', 'Suicide', 'Dead']
const LIFE_WORDS  = ['Life', 'Alive', 'Living', 'Survive', 'Thrive']

type WordType     = 'self' | 'other' | 'death' | 'life'
type ResponseKey  = 'e' | 'i'

interface Trial {
  blockNum:    number
  trialNum:    number
  word:        string
  wordType:    WordType
  correctKey:  ResponseKey
}

interface TrialResponse extends Trial {
  responseKey: ResponseKey
  rt:          number
  isCorrect:   boolean
}

// ─── Block definitions ───────────────────────────────────────────────────────
interface BlockPool { words: string[]; type: WordType; key: ResponseKey }
interface BlockDef {
  blockNum:   number
  count:      number
  label:      string
  leftLabel:  string
  rightLabel: string
  pools:      BlockPool[]
}

const BLOCK_DEFS: BlockDef[] = [
  { blockNum: 1, count: 20, label: 'Practice — Categories',
    leftLabel: 'Self', rightLabel: 'Other',
    pools: [
      { words: SELF_WORDS,  type: 'self',  key: 'e' },
      { words: OTHER_WORDS, type: 'other', key: 'i' },
    ] },
  { blockNum: 2, count: 20, label: 'Practice — Concepts',
    leftLabel: 'Death / Suicide', rightLabel: 'Life',
    pools: [
      { words: DEATH_WORDS, type: 'death', key: 'e' },
      { words: LIFE_WORDS,  type: 'life',  key: 'i' },
    ] },
  { blockNum: 3, count: 20, label: 'Practice — Combined',
    leftLabel: 'Self  or  Death / Suicide', rightLabel: 'Other  or  Life',
    pools: [
      { words: SELF_WORDS,  type: 'self',  key: 'e' },
      { words: DEATH_WORDS, type: 'death', key: 'e' },
      { words: OTHER_WORDS, type: 'other', key: 'i' },
      { words: LIFE_WORDS,  type: 'life',  key: 'i' },
    ] },
  { blockNum: 4, count: 40, label: 'Test — Combined',
    leftLabel: 'Self  or  Death / Suicide', rightLabel: 'Other  or  Life',
    pools: [
      { words: SELF_WORDS,  type: 'self',  key: 'e' },
      { words: DEATH_WORDS, type: 'death', key: 'e' },
      { words: OTHER_WORDS, type: 'other', key: 'i' },
      { words: LIFE_WORDS,  type: 'life',  key: 'i' },
    ] },
  { blockNum: 5, count: 20, label: 'Practice — Categories (switched)',
    leftLabel: 'Other', rightLabel: 'Self',
    pools: [
      { words: OTHER_WORDS, type: 'other', key: 'e' },
      { words: SELF_WORDS,  type: 'self',  key: 'i' },
    ] },
  { blockNum: 6, count: 20, label: 'Practice — Combined (switched)',
    leftLabel: 'Other  or  Death / Suicide', rightLabel: 'Self  or  Life',
    pools: [
      { words: OTHER_WORDS, type: 'other', key: 'e' },
      { words: DEATH_WORDS, type: 'death', key: 'e' },
      { words: SELF_WORDS,  type: 'self',  key: 'i' },
      { words: LIFE_WORDS,  type: 'life',  key: 'i' },
    ] },
  { blockNum: 7, count: 40, label: 'Test — Combined (switched)',
    leftLabel: 'Other  or  Death / Suicide', rightLabel: 'Self  or  Life',
    pools: [
      { words: OTHER_WORDS, type: 'other', key: 'e' },
      { words: DEATH_WORDS, type: 'death', key: 'e' },
      { words: SELF_WORDS,  type: 'self',  key: 'i' },
      { words: LIFE_WORDS,  type: 'life',  key: 'i' },
    ] },
]

// ─── Trial generation ────────────────────────────────────────────────────────
function generateTrials(): Trial[] {
  const all: Trial[] = []
  for (const def of BLOCK_DEFS) {
    for (let t = 0; t < def.count; t++) {
      const pool = def.pools[Math.floor(Math.random() * def.pools.length)]
      const word = pool.words[Math.floor(Math.random() * pool.words.length)]
      all.push({ blockNum: def.blockNum, trialNum: t + 1, word, wordType: pool.type, correctKey: pool.key })
    }
  }
  return all
}

// ─── D-score (Greenwald et al. 2003) ─────────────────────────────────────────
function computeDScore(responses: TrialResponse[]): number | null {
  const b34 = responses.filter(r => [3, 4].includes(r.blockNum) && r.rt <= 10000)
  const b67 = responses.filter(r => [6, 7].includes(r.blockNum) && r.rt <= 10000)
  if (b34.length < 10 || b67.length < 10) return null

  const all       = [...b34, ...b67]
  const fastPct   = all.filter(r => r.rt < 300).length / all.length
  if (fastPct > 0.1) return null

  const mean = (arr: TrialResponse[]) => arr.reduce((s, r) => s + r.rt, 0) / arr.length
  const sd   = (arr: TrialResponse[]) => {
    const m = mean(arr)
    return Math.sqrt(arr.reduce((s, r) => s + (r.rt - m) ** 2, 0) / arr.length)
  }

  const pooledSD = (sd(b34) + sd(b67)) / 2
  if (pooledSD === 0) return null
  return (mean(b67) - mean(b34)) / pooledSD
}

function interpretDScore(d: number): { label: string; detail: string; color: string } {
  if (d < 0)     return { label: 'Slight preference for Life over Death',  detail: 'Implicit associations lean toward life-related concepts when paired with self.',                                    color: '#52B788' }
  if (d < 0.15)  return { label: 'Little or no association',               detail: 'No clear implicit preference between Self–Death and Self–Life pairings.',                                         color: '#888888' }
  if (d < 0.35)  return { label: 'Slight Self–Death association',           detail: 'A slight implicit tendency to associate self-concepts with death/suicide.',                                        color: '#E9C46A' }
  if (d < 0.65)  return { label: 'Moderate Self–Death association',         detail: 'Moderately faster responses when self is paired with death/suicide concepts.',                                    color: '#F4A261' }
  return               { label: 'Strong Self–Death association',            detail: 'Strong implicit association between self-concepts and death/suicide. Consider clinical follow-up.',               color: '#E63946' }
}

// ─── Phase ───────────────────────────────────────────────────────────────────
type Phase = 'loading' | 'intro' | 'block_intro' | 'fixation' | 'stimulus' | 'error' | 'saving' | 'results'

// ─── Component ────────────────────────────────────────────────────────────────
export default function IATPage() {
  const { iatid }  = useParams() as { iatid: string }
  const router     = useRouter()

  const [phase,          setPhase]          = useState<Phase>('loading')
  const [instrument,     setInstrument]     = useState<any>(null)
  const [trials,         setTrials]         = useState<Trial[]>([])
  const [trialIndex,     setTrialIndex]     = useState(0)
  const [blockIntroIdx,  setBlockIntroIdx]  = useState(0)
  const [showError,      setShowError]      = useState(false)
  const [dScore,         setDScore]         = useState<number | null>(null)
  const [userId,         setUserId]         = useState<string | null>(null)

  // Refs that never go stale in event handlers
  const responsesRef    = useRef<TrialResponse[]>([])
  const trialStartRef   = useRef<number>(0)
  const trialsRef       = useRef<Trial[]>([])
  const trialIndexRef   = useRef<number>(0)
  const phaseRef        = useRef<Phase>('loading')
  const respondedRef    = useRef(false) // debounce per trial

  // Keep refs in sync
  useEffect(() => { trialsRef.current    = trials      }, [trials])
  useEffect(() => { trialIndexRef.current = trialIndex  }, [trialIndex])
  useEffect(() => { phaseRef.current     = phase        }, [phase])

  // ─ Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data } = await supabase.from('iat_instruments').select('*').eq('id', iatid).single()
      setInstrument(data)
      const generated = generateTrials()
      setTrials(generated)
      trialsRef.current = generated
      setPhase('intro')
    }
    load()
  }, [iatid])

  // ─ Move to a specific trial index (handles block boundaries + done) ───────
  function goToTrial(idx: number) {
    const all = trialsRef.current
    if (idx >= all.length) {
      // All trials complete — save
      const score = computeDScore(responsesRef.current)
      setDScore(score)
      setPhase('saving')
      phaseRef.current = 'saving'
      saveResults(responsesRef.current)
      return
    }
    const prevTrial = all[idx - 1]
    const nextTrial = all[idx]
    if (!prevTrial || prevTrial.blockNum !== nextTrial.blockNum) {
      // New block — show block intro
      const defIdx = BLOCK_DEFS.findIndex(b => b.blockNum === nextTrial.blockNum)
      setBlockIntroIdx(defIdx)
      setTrialIndex(idx)
      trialIndexRef.current = idx
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
    }, 500)
  }

  // ─ Keyboard handler ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'stimulus') return
      const k = e.key.toLowerCase()
      if (k !== 'e' && k !== 'i') return
      if (respondedRef.current) return   // one response per trial
      e.preventDefault()
      respondedRef.current = true

      const rt          = Math.round(performance.now() - trialStartRef.current)
      const responseKey = k as ResponseKey
      const trial       = trialsRef.current[trialIndexRef.current]
      const isCorrect   = responseKey === trial.correctKey

      const resp: TrialResponse = { ...trial, responseKey, rt, isCorrect }
      responsesRef.current = [...responsesRef.current, resp]

      if (isCorrect) {
        setTimeout(() => goToTrial(trialIndexRef.current + 1), 200)
      } else {
        setShowError(true)
        setPhase('error')
        phaseRef.current = 'error'
        setTimeout(() => {
          setShowError(false)
          goToTrial(trialIndexRef.current + 1)
        }, 800)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, []) // empty deps — uses refs only

  // ─ Save results ───────────────────────────────────────────────────────────
  async function saveResults(finalResponses: TrialResponse[]) {
    if (!userId) return
    const supabase  = createClient()
    const rows      = finalResponses.map(r => ({
      iat_instrument_id: iatid,
      participant_id:    userId,
      block_number:      r.blockNum,
      trial_number:      r.trialNum,
      stimulus_word:     r.word,
      word_type:         r.wordType,
      correct_key:       r.correctKey,
      response_key:      r.responseKey,
      reaction_time_ms:  r.rt,
      is_correct:        r.isCorrect,
    }))
    // insert in chunks of 100
    for (let i = 0; i < rows.length; i += 100) {
      await supabase.from('iat_trial_data').insert(rows.slice(i, i + 100))
    }
    setPhase('results')
  }

  // ─ Derived display values ─────────────────────────────────────────────────
  const currentTrial   = trials[trialIndex]
  const currentBlock   = currentTrial
    ? BLOCK_DEFS.find(b => b.blockNum === currentTrial.blockNum) ?? BLOCK_DEFS[0]
    : BLOCK_DEFS[0]
  const introBlockDef  = BLOCK_DEFS[blockIntroIdx] ?? BLOCK_DEFS[0]
  const totalTrials    = trials.length
  const isCritical     = [4, 7].includes(introBlockDef.blockNum)
  const isReversed     = introBlockDef.blockNum === 5

  // ─── Render ───────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading IAT…</p>
      </div>
    )
  }

  // Full-screen dark task screen
  if (['block_intro', 'fixation', 'stimulus', 'error'].includes(phase)) {
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

              {isCritical && (
                <p className="text-[#E9C46A] text-xs mb-3">
                  This is a scored block. Go as fast as you can while still being accurate.
                </p>
              )}
              {isReversed && (
                <p className="text-[#F4A261] text-xs mb-3">
                  ⚠ The category sides have switched. Pay close attention.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 my-6">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-2">E key</p>
                  <p className="text-white font-bold text-sm leading-snug">{introBlockDef.leftLabel}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-2">I key</p>
                  <p className="text-white font-bold text-sm leading-snug">{introBlockDef.rightLabel}</p>
                </div>
              </div>

              <p className="text-gray-400 text-sm mb-6">
                Press{' '}
                <kbd className="bg-gray-700 px-2 py-0.5 rounded text-white text-xs">E</kbd>
                {' '}or{' '}
                <kbd className="bg-gray-700 px-2 py-0.5 rounded text-white text-xs">I</kbd>
                {' '}as quickly and accurately as possible.
              </p>

              <button
                onClick={startFixation}
                className="bg-white text-black font-semibold px-8 py-3 rounded-xl hover:bg-gray-100 transition-colors"
              >
                I am ready — begin block {introBlockDef.blockNum}
              </button>
            </div>
          </div>
        )}

        {/* ── Fixation / Stimulus / Error ──────────────────────────────────── */}
        {['fixation', 'stimulus', 'error'].includes(phase) && (
          <>
            {/* Category labels */}
            <div className="flex justify-between px-8 pt-6 pb-3 shrink-0">
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">E key</p>
                <p className="text-white font-bold text-base leading-snug max-w-[180px]">
                  {currentBlock.leftLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">I key</p>
                <p className="text-white font-bold text-base leading-snug max-w-[180px]">
                  {currentBlock.rightLabel}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-px bg-gray-800 shrink-0">
              <div
                className="h-full bg-gray-600 transition-all duration-150"
                style={{ width: `${(trialIndex / totalTrials) * 100}%` }}
              />
            </div>

            {/* Centre area */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {phase === 'fixation' && (
                <span className="text-white text-5xl font-light">+</span>
              )}
              {(phase === 'stimulus' || phase === 'error') && currentTrial && (
                <div className="text-center">
                  <p className="text-white text-5xl font-bold tracking-wide select-none">
                    {currentTrial.word}
                  </p>
                  {showError && (
                    <p className="text-[#E63946] text-6xl mt-6 font-bold leading-none">✕</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <p className="text-gray-700 text-xs text-center pb-4 shrink-0">
              Block {currentTrial?.blockNum} / {BLOCK_DEFS.length} · Trial {trialIndex + 1} / {totalTrials}
            </p>
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
              This test measures automatic associations — thought patterns you may not be consciously aware of.
            </p>
          </div>

          <div className="border border-border rounded-xl p-5 mb-5 space-y-3">
            <h2 className="font-serif text-base font-semibold">How it works</h2>
            <ol className="space-y-2 text-sm text-muted-foreground list-none">
              {[
                'Words appear one at a time on a dark screen.',
                <>Press <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">E</kbd> for categories on the left, <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs ml-1">I</kbd> for the right.</>,
                'Go as fast as you can. A red ✕ means wrong key — you can keep going.',
                '7 short blocks total. Takes about 12 minutes.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-foreground font-bold shrink-0 w-4">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

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

          <div className="bg-muted/40 rounded-xl p-4 text-xs text-muted-foreground mb-6">
            <strong>A note before you begin:</strong> This IAT measures implicit associations between
            self-concepts and Death / Life words. A result in any direction does not define you.
            Remember — this reflects automatic patterns, not your conscious beliefs or character.
            <strong> You are more than your reaction time.</strong>
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
            I am ready — begin
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

  // ─── Results ──────────────────────────────────────────────────────────────
  if (phase === 'results') {
    const interp = dScore !== null ? interpretDScore(dScore) : null

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full">
          <h1 className="font-serif text-2xl text-foreground text-center mb-8">Your IAT result</h1>

          {dScore !== null && interp ? (
            <>
              {/* D-score */}
              <div
                className="rounded-2xl p-6 text-center mb-5"
                style={{ backgroundColor: interp.color + '18', border: `1px solid ${interp.color}40` }}
              >
                <p className="font-serif text-7xl font-bold mb-1" style={{ color: interp.color }}>
                  {dScore.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">D-score</p>
                <p className="font-semibold text-sm mb-1" style={{ color: interp.color }}>
                  {interp.label}
                </p>
                <p className="text-xs text-muted-foreground">{interp.detail}</p>
              </div>

              {/* Scale reference */}
              <div className="border border-border rounded-xl p-4 mb-5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-sm mb-3">D-score reference</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['< 0',        'Leans toward Life',    '#52B788'],
                    ['0 – 0.15',   'Little association',   '#888888'],
                    ['0.15 – 0.35','Slight Self–Death',    '#E9C46A'],
                    ['0.35 – 0.65','Moderate Self–Death',  '#F4A261'],
                    ['> 0.65',     'Strong Self–Death',    '#E63946'],
                  ].map(([range, label, color]) => (
                    <div key={range} className="bg-muted rounded-lg p-2 text-center">
                      <p className="font-mono text-foreground text-[11px]">{range}</p>
                      <p style={{ color }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="border border-border rounded-xl p-6 text-center mb-5">
              <p className="text-muted-foreground text-sm">
                Your D-score could not be computed (too many very fast or slow responses).
                Your trial data has been saved for your researcher.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground italic text-center mb-6">
            Remember — this reflects automatic patterns, not your conscious beliefs or character.
            You are more than your reaction time.
          </p>

          <Button variant="outline" className="w-full" onClick={() => router.push('/participant/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  return null
}
