'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ConsentScreen } from '@/components/consent-screen'
import { CrisisResources } from '@/components/crisis-resources'
import { getIATType, type IATTypeConfig, type WordCategory } from '@/lib/iat-types'

// ─── Block types ──────────────────────────────────────────────────────────────
type ResponseKey = 'e' | 'i'

interface Trial {
  blockNum:   number
  trialNum:   number
  word:       string
  wordCat:    WordCategory  // 'conceptA' | 'conceptB' | 'attrA' | 'attrB'
  correctKey: ResponseKey
}

interface TrialResponse extends Trial {
  responseKey: ResponseKey
  rt:          number   // raw RT (ms)
  isCorrect:   boolean
}

interface BlockPool {
  words:   string[]
  cat:     WordCategory
  key:     ResponseKey
}

interface BlockDef {
  blockNum:   number
  count:      number
  label:      string
  leftLabel:  string
  rightLabel: string
  pools:      BlockPool[]
  isScored:   boolean
}

// ─── Block generation ─────────────────────────────────────────────────────────
// All IAT types share the same 7-block structure (Greenwald 2003 D2).
// Only the word lists change — provided by the IATTypeConfig from the registry.
//
//   B1 (20): ConceptA vs ConceptB           — practice targets
//   B2 (20): AttrA vs AttrB                 — practice attributes
//   B3 (20): ConceptA+AttrA vs ConceptB+AttrB — practice combined (scored by D2)
//   B4 (40): ConceptA+AttrA vs ConceptB+AttrB — test combined (scored by D2)
//   B5 (20): ConceptB vs ConceptA           — practice reversed (Short-IAT; Nosek 2005)
//   B6 (20): ConceptB+AttrA vs ConceptA+AttrB — practice combined reversed (scored)
//   B7 (40): ConceptB+AttrA vs ConceptA+AttrB — test combined reversed (scored)
//
// Counterbalancing (Order B): B3/B4 and B6/B7 content is swapped so half of
// participants encounter ConceptA+AttrB first.  Block numbers stay fixed so
// the D2 formula is unchanged.  D-score sign is flipped for Order B to keep
// "positive D = ConceptA–AttrA association" consistent across orders.

function buildBlockDefs(cfg: IATTypeConfig, orderB: boolean): BlockDef[] {
  const { conceptALabel: cA, conceptBLabel: cB, attrALabel: aA, attrBLabel: aB } = cfg
  const wA = cfg.wordsConceptA
  const wB = cfg.wordsConceptB
  const wAtA = cfg.wordsAttrA
  const wAtB = cfg.wordsAttrB

  // Order A (default)
  const blocks: BlockDef[] = [
    {
      blockNum: 1, count: 20, isScored: false,
      label: `Practice — ${cA} vs ${cB}`,
      leftLabel: cA, rightLabel: cB,
      pools: [
        { words: wA,   cat: 'conceptA', key: 'e' },
        { words: wB,   cat: 'conceptB', key: 'i' },
      ],
    },
    {
      blockNum: 2, count: 20, isScored: false,
      label: `Practice — ${aA} vs ${aB}`,
      leftLabel: aA, rightLabel: aB,
      pools: [
        { words: wAtA, cat: 'attrA', key: 'e' },
        { words: wAtB, cat: 'attrB', key: 'i' },
      ],
    },
    {
      blockNum: 3, count: 20, isScored: false,
      label: `Practice — ${cA} + ${aA}`,
      leftLabel: `${cA}  or  ${aA}`, rightLabel: `${cB}  or  ${aB}`,
      pools: [
        { words: wA,   cat: 'conceptA', key: 'e' },
        { words: wAtA, cat: 'attrA',    key: 'e' },
        { words: wB,   cat: 'conceptB', key: 'i' },
        { words: wAtB, cat: 'attrB',    key: 'i' },
      ],
    },
    {
      blockNum: 4, count: 40, isScored: true,
      label: `Test — ${cA} + ${aA}`,
      leftLabel: `${cA}  or  ${aA}`, rightLabel: `${cB}  or  ${aB}`,
      pools: [
        { words: wA,   cat: 'conceptA', key: 'e' },
        { words: wAtA, cat: 'attrA',    key: 'e' },
        { words: wB,   cat: 'conceptB', key: 'i' },
        { words: wAtB, cat: 'attrB',    key: 'i' },
      ],
    },
    {
      // Block 5: 20 trials (Short-IAT modification; Nosek et al. 2005)
      blockNum: 5, count: 20, isScored: false,
      label: `Practice — ${cB} vs ${cA} (switched)`,
      leftLabel: cB, rightLabel: cA,
      pools: [
        { words: wB, cat: 'conceptB', key: 'e' },
        { words: wA, cat: 'conceptA', key: 'i' },
      ],
    },
    {
      blockNum: 6, count: 20, isScored: false,
      label: `Practice — ${cB} + ${aA}`,
      leftLabel: `${cB}  or  ${aA}`, rightLabel: `${cA}  or  ${aB}`,
      pools: [
        { words: wB,   cat: 'conceptB', key: 'e' },
        { words: wAtA, cat: 'attrA',    key: 'e' },
        { words: wA,   cat: 'conceptA', key: 'i' },
        { words: wAtB, cat: 'attrB',    key: 'i' },
      ],
    },
    {
      blockNum: 7, count: 40, isScored: true,
      label: `Test — ${cB} + ${aA}`,
      leftLabel: `${cB}  or  ${aA}`, rightLabel: `${cA}  or  ${aB}`,
      pools: [
        { words: wB,   cat: 'conceptB', key: 'e' },
        { words: wAtA, cat: 'attrA',    key: 'e' },
        { words: wA,   cat: 'conceptA', key: 'i' },
        { words: wAtB, cat: 'attrB',    key: 'i' },
      ],
    },
  ]

  if (!orderB) return blocks

  // Order B: swap B3/B4 ↔ B6/B7 content (pools + labels)
  return blocks.map(def => {
    if (def.blockNum === 3) {
      const src = blocks.find(b => b.blockNum === 6)!
      return { ...def, label: src.label.replace('Practice', 'Practice'), leftLabel: src.leftLabel, rightLabel: src.rightLabel, pools: src.pools }
    }
    if (def.blockNum === 4) {
      const src = blocks.find(b => b.blockNum === 7)!
      return { ...def, leftLabel: src.leftLabel, rightLabel: src.rightLabel, pools: src.pools }
    }
    if (def.blockNum === 5) {
      // Reversed — flip pool keys
      return { ...def, leftLabel: def.rightLabel, rightLabel: def.leftLabel,
        pools: def.pools.map(p => ({ ...p, key: p.key === 'e' ? 'i' : 'e' as ResponseKey })) }
    }
    if (def.blockNum === 6) {
      const src = blocks.find(b => b.blockNum === 3)!
      return { ...def, leftLabel: src.leftLabel, rightLabel: src.rightLabel, pools: src.pools }
    }
    if (def.blockNum === 7) {
      const src = blocks.find(b => b.blockNum === 4)!
      return { ...def, leftLabel: src.leftLabel, rightLabel: src.rightLabel, pools: src.pools }
    }
    return def
  })
}

function generateBalancedBlock(def: BlockDef): Trial[] {
  const trialsPerPool = Math.floor(def.count / def.pools.length)
  const extra         = def.count - trialsPerPool * def.pools.length
  const raw: Trial[]  = []

  def.pools.forEach((pool, pi) => {
    const poolCount = trialsPerPool + (pi < extra ? 1 : 0)
    for (let i = 0; i < poolCount; i++) {
      raw.push({
        blockNum:   def.blockNum,
        trialNum:   0,
        word:       pool.words[i % pool.words.length],
        wordCat:    pool.cat,
        correctKey: pool.key,
      })
    }
  })

  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]]
  }
  return raw.map((t, idx) => ({ ...t, trialNum: idx + 1 }))
}

function generateTrials(defs: BlockDef[]): Trial[] {
  return defs.flatMap(def => generateBalancedBlock(def))
}

// ─── D-score Algorithm D2 (Greenwald et al. 2003) ───────────────────────────
function computeDScore(
  responses: TrialResponse[],
  orderB: boolean,
): { d: number | null; excluded: boolean; reason?: string } {
  const scoringBlocks = [3, 4, 6, 7]
  const all = responses.filter(r => scoringBlocks.includes(r.blockNum))
  if (all.length < 20) return { d: null, excluded: true, reason: 'Too few trials in scoring blocks.' }

  const capped   = all.map(r => ({ ...r, rt: Math.min(r.rt, 10_000) }))
  const fastPct  = capped.filter(r => r.rt < 300).length / capped.length
  if (fastPct > 0.10) return { d: null, excluded: true, reason: `${Math.round(fastPct * 100)}% of responses were faster than 300 ms — data excluded.` }

  const b34 = capped.filter(r => r.blockNum === 3 || r.blockNum === 4)
  const b67 = capped.filter(r => r.blockNum === 6 || r.blockNum === 7)
  if (b34.length < 10 || b67.length < 10) return { d: null, excluded: true, reason: 'Insufficient trials in one block pair.' }

  const mean = (arr: { rt: number }[]) => arr.reduce((s, r) => s + r.rt, 0) / arr.length

  const pen34 = b34.map(r => r.isCorrect ? r.rt : mean(b34.filter(x => x.isCorrect)) + 600)
  const pen67 = b67.map(r => r.isCorrect ? r.rt : mean(b67.filter(x => x.isCorrect)) + 600)

  const m34 = pen34.reduce((s, v) => s + v, 0) / pen34.length
  const m67 = pen67.reduce((s, v) => s + v, 0) / pen67.length

  const allPen    = [...pen34, ...pen67]
  const grandMean = allPen.reduce((s, v) => s + v, 0) / allPen.length
  const pooledSD  = Math.sqrt(allPen.reduce((s, v) => s + (v - grandMean) ** 2, 0) / allPen.length)

  if (pooledSD === 0) return { d: null, excluded: true, reason: 'All response times identical.' }

  const rawD = (m67 - m34) / pooledSD
  return { d: orderB ? -rawD : rawD, excluded: false }
}

// ─── Phase ────────────────────────────────────────────────────────────────────
type Phase =
  | 'loading' | 'consent' | 'mobile_warning' | 'already_done'
  | 'intro' | 'block_intro' | 'fixation' | 'stimulus' | 'error_feedback'
  | 'saving' | 'save_error' | 'results'

// ─── Component ────────────────────────────────────────────────────────────────
export default function IATPage() {
  const { iatid }  = useParams() as { iatid: string }
  const router     = useRouter()

  const [phase,         setPhase]         = useState<Phase>('loading')
  const [instrument,    setInstrument]    = useState<any>(null)
  const [iatCfg,        setIatCfg]        = useState<IATTypeConfig | null>(null)
  const [trials,        setTrials]        = useState<Trial[]>([])
  const [trialIndex,    setTrialIndex]    = useState(0)
  const [blockIntroIdx, setBlockIntroIdx] = useState(0)
  const [showError,     setShowError]     = useState(false)
  const [dResult,       setDResult]       = useState<{ d: number | null; excluded: boolean; reason?: string } | null>(null)
  const [blockErrors,   setBlockErrors]   = useState(0)
  const [blockTotal,    setBlockTotal]    = useState(0)
  const [consentText,   setConsentText]   = useState<string | null>(null)
  const [studyId,       setStudyId]       = useState<string | null>(null)
  const [orderB,        setOrderB]        = useState(false)
  const [blockDefs,     setBlockDefs]     = useState<BlockDef[]>([])
  const [saveError,     setSaveError]     = useState<string | null>(null)
  const [retrying,      setRetrying]      = useState(false)
  const orderBRef   = useRef(false)
  const iatCfgRef   = useRef<IATTypeConfig | null>(null)

  const responsesRef   = useRef<TrialResponse[]>([])
  const trialStartRef  = useRef<number>(0)
  const trialsRef      = useRef<Trial[]>([])
  const trialIndexRef  = useRef<number>(0)
  const phaseRef       = useRef<Phase>('loading')
  const respondedRef   = useRef(false)
  const sessionIdRef   = useRef<string>(crypto.randomUUID())

  useEffect(() => { trialsRef.current     = trials     }, [trials])
  useEffect(() => { trialIndexRef.current = trialIndex }, [trialIndex])
  useEffect(() => { phaseRef.current      = phase      }, [phase])

  // ─ Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: instr } = await supabase
        .from('iat_instruments')
        .select('*')
        .eq('id', iatid)
        .single()
      setInstrument(instr)

      // Resolve IAT type config (falls back to death_suicide)
      const cfg = getIATType(instr?.iat_type)
      setIatCfg(cfg)
      iatCfgRef.current = cfg

      if (instr?.study_id) {
        setStudyId(instr.study_id)
        const { data: enrollment } = await supabase
          .from('study_enrollments')
          .select('consented_at')
          .eq('study_id', instr.study_id)
          .eq('participant_id', user.id)
          .maybeSingle()

        if (!enrollment?.consented_at) {
          const { data: study } = await supabase
            .from('studies').select('consent_text').eq('id', instr.study_id).single()
          setConsentText(study?.consent_text ?? null)
          setPhase('consent')
          return
        }
      }

      const isTouchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches
      if (isTouchOnly) { setPhase('mobile_warning'); return }

      // Completion check: iat_session_results is the canonical completion marker
      const { data: existing } = await supabase
        .from('iat_session_results')
        .select('session_id')
        .eq('iat_id', iatid)
        .eq('participant_id', user.id)
        .maybeSingle()
      if (existing) { setPhase('already_done'); return }

      const assignedOrderB = Math.random() < 0.5
      setOrderB(assignedOrderB)
      orderBRef.current = assignedOrderB
      const defs = buildBlockDefs(cfg, assignedOrderB)
      setBlockDefs(defs)
      const generated = generateTrials(defs)
      setTrials(generated)
      trialsRef.current = generated
      setPhase('intro')
    }
    load()
  }, [iatid])

  // ─ Save via server API ────────────────────────────────────────────────────
  async function saveResults(
    finalResponses: TrialResponse[],
    result: { d: number | null; excluded: boolean; reason?: string },
  ) {
    const payload = {
      sessionId:     sessionIdRef.current,
      assignedOrder: orderBRef.current ? 'B' : 'A',
      dScore:        result.d,
      excluded:      result.excluded,
      exclusionReason: result.reason,
      trials: finalResponses.map(r => ({
        blockNumber:         r.blockNum,
        trialNumber:         r.trialNum,
        stimulusText:        r.word,
        stimulusCategory:    r.wordCat,
        correctKey:          r.correctKey,
        pressedKey:          r.responseKey,
        responseTimeMs:      r.rt,
        isCorrect:           r.isCorrect,
        isTooFast:           r.rt < 300,
        excludedFromScoring: ![3, 4, 6, 7].includes(r.blockNum),
      })),
    }

    const MAX_ATTEMPTS = 3
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res  = await fetch(`/api/iat/${iatid}/submit`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        const json = await res.json()
        if (res.ok || res.status === 409) { setPhase('results'); return }
        if (attempt === MAX_ATTEMPTS) { setSaveError(json.error ?? 'Server error'); setPhase('save_error'); return }
      } catch {
        if (attempt === MAX_ATTEMPTS) { setSaveError('Network error — please check your connection.'); setPhase('save_error'); return }
      }
      await new Promise(r => setTimeout(r, attempt * 2000))
    }
  }

  // ─ Trial navigation ───────────────────────────────────────────────────────
  function goToTrial(idx: number) {
    const all = trialsRef.current
    if (idx >= all.length) {
      const result = computeDScore(responsesRef.current, orderBRef.current)
      setDResult(result)
      setPhase('saving')
      phaseRef.current = 'saving'
      saveResults(responsesRef.current, result)
      return
    }
    const prev    = all[idx - 1]
    const next    = all[idx]
    const newBlock = !prev || prev.blockNum !== next.blockNum

    if (newBlock) {
      const defIdx = blockDefs.findIndex(b => b.blockNum === next.blockNum)
      setBlockIntroIdx(defIdx)
      setTrialIndex(idx); trialIndexRef.current = idx
      setBlockErrors(0); setBlockTotal(0)
      setPhase('block_intro'); phaseRef.current = 'block_intro'
    } else {
      setTrialIndex(idx); trialIndexRef.current = idx
      startFixation()
    }
  }

  function startFixation() {
    setPhase('fixation'); phaseRef.current = 'fixation'
    setTimeout(() => {
      trialStartRef.current = performance.now()
      respondedRef.current  = false
      setPhase('stimulus'); phaseRef.current = 'stimulus'
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

      responsesRef.current = [...responsesRef.current, { ...trial, responseKey, rt, isCorrect }]
      setBlockTotal(t => t + 1)
      if (!isCorrect) setBlockErrors(c => c + 1)

      if (isCorrect) {
        setTimeout(() => goToTrial(trialIndexRef.current + 1), 150)
      } else {
        setShowError(true); setPhase('error_feedback'); phaseRef.current = 'error_feedback'
        setTimeout(() => { setShowError(false); goToTrial(trialIndexRef.current + 1) }, 800)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ─ Derived values ─────────────────────────────────────────────────────────
  const currentTrial  = trials[trialIndex]
  const currentBlock  = currentTrial ? (blockDefs.find(b => b.blockNum === currentTrial.blockNum) ?? blockDefs[0]) : blockDefs[0]
  const introBlockDef = blockDefs[blockIntroIdx] ?? blockDefs[0]
  const totalTrials   = trials.length
  const isScoredBlock = introBlockDef?.isScored ?? false
  const isSwitched    = introBlockDef?.blockNum === 5
  const cfg           = iatCfg

  // ─── Render ───────────────────────────────────────────────────────────────

  if (phase === 'loading' || !cfg) {
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
          if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) { setPhase('mobile_warning'); return }
          const defs = buildBlockDefs(cfg, orderB)
          setBlockDefs(defs)
          const generated = generateTrials(defs)
          setTrials(generated); trialsRef.current = generated
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
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            The IAT requires fast, accurate key presses using{' '}
            <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">E</kbd> and{' '}
            <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">I</kbd> keys.
            Touch-screen input cannot capture precise reaction times. Please return on a laptop or desktop.
          </p>
          <Button variant="outline" onClick={() => router.push('/participant/dashboard')}>Back to dashboard</Button>
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
          <Button variant="outline" onClick={() => router.push('/participant/dashboard')}>Back to dashboard</Button>
        </div>
      </div>
    )
  }

  // ─── Full-screen dark task UI ──────────────────────────────────────────────
  if (['block_intro', 'fixation', 'stimulus', 'error_feedback'].includes(phase) && introBlockDef) {
    return (
      <div className="fixed inset-0 bg-[#1A1A1A] flex flex-col overflow-hidden select-none">

        {phase === 'block_intro' && (
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            <div className="max-w-lg w-full text-center">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">
                Block {introBlockDef.blockNum} of {blockDefs.length}
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

        {['fixation', 'stimulus', 'error_feedback'].includes(phase) && currentBlock && (
          <>
            <div className="flex justify-between px-8 pt-6 pb-3 shrink-0">
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">E key</p>
                <p className="text-white font-bold text-base leading-snug max-w-[200px]">{currentBlock.leftLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">I key</p>
                <p className="text-white font-bold text-base leading-snug max-w-[200px]">{currentBlock.rightLabel}</p>
              </div>
            </div>

            <div className="w-full h-0.5 bg-gray-800 shrink-0">
              <div className="h-full bg-gray-600 transition-all duration-100" style={{ width: `${(trialIndex / totalTrials) * 100}%` }} />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              {phase === 'fixation' && <span className="text-gray-600 text-5xl font-light">+</span>}
              {(phase === 'stimulus' || phase === 'error_feedback') && currentTrial && (
                <div className="text-center">
                  <p className="text-white text-5xl font-bold tracking-wide select-none">{currentTrial.word}</p>
                  {showError && <p className="text-[#E63946] text-5xl mt-4 font-bold">✕</p>}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center px-8 pb-4 shrink-0">
              <p className="text-gray-700 text-xs">Block {currentTrial?.blockNum} / {blockDefs.length}{currentBlock.isScored ? ' ★' : ''}</p>
              <p className="text-gray-700 text-xs">Trial {trialIndex + 1} / {totalTrials}</p>
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
              {instrument?.title ?? cfg.name}
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
                'A red ✕ means wrong key — correct it and keep going straight away.',
                <>There are <strong>7 blocks</strong> total (~{cfg.estimatedMinutes} minutes). Blocks 1 and 2 are practice — no results collected.</>,
                'Complete in one sitting without interruption for valid results.',
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
              <p className="text-sm font-bold">{cfg.conceptALabel}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cfg.wordsConceptA.join(' · ')}</p>
            </div>
            <div className="border border-border rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">I key (right)</p>
              <p className="text-sm font-bold">{cfg.conceptBLabel}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cfg.wordsConceptB.join(' · ')}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 mb-6 space-y-1.5 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
            <p className="font-semibold">Before you begin:</p>
            <p>{cfg.defaultDebriefNote}</p>
            <p className="font-semibold">You are more than your reaction time.</p>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              setBlockIntroIdx(0)
              setTrialIndex(0); trialIndexRef.current = 0
              setPhase('block_intro'); phaseRef.current = 'block_intro'
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
          <p className="text-xs text-muted-foreground mt-2">Please do not close this tab.</p>
        </div>
      </div>
    )
  }

  // ─── Save error ───────────────────────────────────────────────────────────
  if (phase === 'save_error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <p className="text-4xl mb-4">⚠️</p>
          <h1 className="font-serif text-2xl text-foreground mb-3">Save failed</h1>
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            Your responses could not be saved. This is usually a temporary network issue.
            Your data is held in memory — clicking Retry will attempt to save again without losing any data.
          </p>
          {saveError && (
            <p className="text-xs text-muted-foreground/70 font-mono bg-muted/50 rounded-lg p-3 mb-5 text-left">{saveError}</p>
          )}
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              onClick={async () => {
                if (retrying || !dResult) return
                setRetrying(true); setSaveError(null); setPhase('saving')
                await saveResults(responsesRef.current, dResult)
                setRetrying(false)
              }}
              disabled={retrying}
            >
              {retrying ? 'Retrying…' : 'Retry save'}
            </Button>
            <p className="text-xs text-muted-foreground">
              If the problem persists, please contact your researcher and let them know you completed the task.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Results / Debrief ────────────────────────────────────────────────────
  if (phase === 'results') {
    const customDebrief = instrument?.debrief_text?.trim()
    const dataNote = dResult?.excluded
      ? `Note: Your data could not be scored (${dResult.reason ?? 'response patterns excluded'}).`
      : null
    const isClinical = cfg.key === 'death_suicide'

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
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{customDebrief}</p>
            </div>
          ) : (
            <div className="border border-border rounded-xl p-5 mb-5 space-y-3">
              <h2 className="font-serif text-base font-semibold">About this IAT</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{cfg.defaultDebriefNote}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                IAT scores have limited predictive value at the individual level and should
                always be interpreted alongside other measures by a qualified researcher.
                A result in any direction is not a diagnosis.
              </p>
              <p className="text-sm font-medium text-foreground">You are more than your reaction time.</p>
            </div>
          )}

          {dataNote && (
            <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 rounded-xl p-4 mb-5">
              <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">{dataNote}</p>
            </div>
          )}

          {isClinical && (
            <div className="mb-6">
              <CrisisResources
                title="Support is available any time"
                subtitle="The Death/Suicide IAT can bring up difficult thoughts. If you are struggling, please reach out — free, confidential support is available 24/7."
              />
            </div>
          )}

          <Button className="w-full" onClick={() => router.push('/participant/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  return null
}
