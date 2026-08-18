'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  BUILT_IN_SCALES,
  getSeverityBand,
  getMaxItemScore,
  type BuiltInScale,
  type SeverityBand,
} from '@/lib/scales'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { CheckCircle, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Check, Rows3, Square } from 'lucide-react'
import { toast } from 'sonner'
import { ConsentScreen } from '@/components/consent-screen'
import { CrisisResources } from '@/components/crisis-resources'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResponseOption {
  value: number
  label: string
}

interface QuestionnaireItem {
  id: string
  item_text: string
  item_code: string
  display_order: number
  response_options: ResponseOption[]
  is_clinical_flag_item: boolean
  clinical_flag_threshold: number | null
  clinical_flag_operator: string | null
  clinical_flag_message: string | null
  is_reverse_scored: boolean
  scoring_weight: number | null
}

interface QuestionnaireInstrument {
  id: string
  study_id: string
  title: string
  instructions: string | null
  validated_scale_name: string | null
  is_validated_scale: boolean
  clinical_alert_enabled: boolean
  clinical_alert_threshold: number | null
  show_score_to_participant: boolean | null
}

type ViewMode = 'all' | 'step'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuestionnairePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qid = params.qid as string
  const isPreview = searchParams.get('preview') === '1'

  const [questionnaire, setQuestionnaire] = useState<QuestionnaireInstrument | null>(null)
  const [items, setItems] = useState<QuestionnaireItem[]>([])
  const [responses, setResponses] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [severity, setSeverity] = useState<SeverityBand | null>(null)
  const [scale, setScale] = useState<BuiltInScale | null>(null)
  const [clinicalFlagged, setClinicalFlagged] = useState(false)
  const [showScoreToParticipant, setShowScoreToParticipant] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  // Consent gate
  const [needsConsent, setNeedsConsent] = useState(false)
  const [consentText, setConsentText] = useState<string | null>(null)
  const [studyId, setStudyId] = useState<string | null>(null)
  // Permanent flag tracking: once an item exceeds threshold, keeps showing warning
  const [everFlaggedItems, setEverFlaggedItems] = useState<Set<string>>(new Set())
  // Highlight unanswered items after failed submit attempt
  const [highlightUnanswered, setHighlightUnanswered] = useState(false)
  // Autosave feedback + resume banner
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [resumed, setResumed] = useState(false)
  // View mode: long-scroll list vs one-at-a-time step flow
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [stepIndex, setStepIndex] = useState(0)
  // Refs for scrolling to first unanswered item
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Default to step mode on small screens for a friendlier flow
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) {
        setViewMode('step')
      }

      // ── Load questionnaire instrument ─────────────────────────────────────
      const { data: q } = await supabase
        .from('questionnaire_instruments')
        .select('id, study_id, title, instructions, validated_scale_name, is_validated_scale, clinical_alert_enabled, clinical_alert_threshold, show_score_to_participant')
        .eq('id', qid)
        .single()

      if (!q) { setLoading(false); return }
      setQuestionnaire(q)
      setStudyId(q.study_id)
      setShowScoreToParticipant(!!q.show_score_to_participant)

      // ── Match built-in scale ──────────────────────────────────────────────
      let matchedScale: BuiltInScale | null = null
      if (q.validated_scale_name) {
        matchedScale = BUILT_IN_SCALES.find(s => s.abbreviation === q.validated_scale_name) ?? null
        if (matchedScale) setScale(matchedScale)
      }

      // ── Preview mode: skip consent + submitted-check; just load items
      if (isPreview) {
        const { data: itemData } = await supabase
          .from('questionnaire_items')
          .select('id, item_text, item_code, display_order, response_options, is_clinical_flag_item, clinical_flag_threshold, clinical_flag_operator, clinical_flag_message, is_reverse_scored, scoring_weight')
          .eq('questionnaire_id', qid)
          .eq('is_active', true)
          .order('display_order', { ascending: true })
        setItems(itemData ?? [])
        setLoading(false)
        return
      }

      // ── Check consent (fail *closed*: if we can't confirm consent, ask for
      // it, rather than silently proceeding). Consent gates only the display —
      // items are still loaded below either way. ──
      const { data: enrollment, error: enrollErr } = await supabase
        .from('study_enrollments')
        .select('consented_at')
        .eq('study_id', q.study_id)
        .eq('participant_id', user.id)
        .maybeSingle()

      if (enrollErr || !enrollment?.consented_at) {
        const { data: studyData } = await supabase
          .from('studies')
          .select('consent_text')
          .eq('id', q.study_id)
          .single()
        setConsentText(studyData?.consent_text ?? null)
        setNeedsConsent(true)
      }

      // ── Check already submitted ────────────────────────────────────────────
      const { data: existingResult } = await supabase
        .from('questionnaire_scored_results')
        .select('id, total_score, severity_label')
        .eq('questionnaire_id', qid)
        .eq('participant_id', user.id)
        .eq('is_complete', true)
        .maybeSingle()

      if (existingResult) {
        const existingBand = matchedScale
          ? getSeverityBand(matchedScale, existingResult.total_score)
          : null
        setScore(existingResult.total_score)
        setSeverity(existingBand)
        setSubmitted(true)
        setLoading(false)
        return
      }

      // ── Load items ────────────────────────────────────────────────────────
      const { data: itemData } = await supabase
        .from('questionnaire_items')
        .select('id, item_text, item_code, display_order, response_options, is_clinical_flag_item, clinical_flag_threshold, clinical_flag_operator, clinical_flag_message, is_reverse_scored, scoring_weight')
        .eq('questionnaire_id', qid)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      setItems(itemData ?? [])

      // ── Resume in-progress answers ─────────────────────────────────────────
      const { data: inProgress } = await supabase
        .from('questionnaire_item_responses')
        .select('item_id, raw_response_numeric')
        .eq('questionnaire_id', qid)
        .eq('participant_id', user.id)

      if (inProgress && inProgress.length > 0) {
        const resumedResponses: Record<string, number> = {}
        for (const r of inProgress) {
          if (r.raw_response_numeric !== null && r.raw_response_numeric !== undefined) {
            resumedResponses[r.item_id] = Number(r.raw_response_numeric)
          }
        }
        if (Object.keys(resumedResponses).length > 0) {
          setResponses(resumedResponses)
          setResumed(true)
          // In step mode, jump to the first unanswered question
          const firstUnansweredIdx = (itemData ?? []).findIndex(it => resumedResponses[it.id] === undefined)
          if (firstUnansweredIdx > 0) setStepIndex(firstUnansweredIdx)
        }
        // Re-apply permanent flag tracking
        const flagged = new Set<string>()
        for (const it of itemData ?? []) {
          const v = resumedResponses[it.id]
          if (
            v !== undefined &&
            it.is_clinical_flag_item &&
            it.clinical_flag_threshold !== null &&
            it.clinical_flag_operator === 'gte' &&
            v >= it.clinical_flag_threshold
          ) flagged.add(it.id)
        }
        setEverFlaggedItems(flagged)
      }

      setLoading(false)
    }
    load()
  }, [qid, isPreview])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleResponse = (itemId: string, value: number) => {
    setResponses(prev => ({ ...prev, [itemId]: value }))
    setHighlightUnanswered(false) // reset highlight when user answers

    // Permanent clinical flag tracking
    const item = items.find(i => i.id === itemId)
    const nowFlagged =
      item?.is_clinical_flag_item &&
      item.clinical_flag_threshold !== null &&
      item.clinical_flag_operator === 'gte' &&
      value >= item.clinical_flag_threshold
    if (nowFlagged) {
      setEverFlaggedItems(prev => new Set([...prev, itemId]))
    }

    // Autosave (fire-and-forget; skipped in preview) — with visible feedback
    if (!isPreview) {
      setSaveStatus('saving')
      fetch(`/api/questionnaire/${qid}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, rawValue: value }),
      })
        .then(() => {
          setSaveStatus('saved')
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
        })
        .catch(() => setSaveStatus('idle'))
    }

    // Step mode: auto-advance to the next question (unless a clinical flag just
    // fired — then stay so the participant sees the support message).
    if (viewMode === 'step' && !nowFlagged) {
      const idx = items.findIndex(i => i.id === itemId)
      if (idx >= 0 && idx < items.length - 1) {
        setTimeout(() => setStepIndex(i => (i === idx ? idx + 1 : i)), 260)
      }
    }
  }

  const answeredCount = Object.keys(responses).length
  const totalItems = items.length
  const progress = totalItems > 0 ? (answeredCount / totalItems) * 100 : 0
  const allAnswered = answeredCount === totalItems && totalItems > 0
  const unansweredItems = items.filter(i => responses[i.id] === undefined)

  const scrollToFirstUnanswered = () => {
    const first = unansweredItems[0]
    if (viewMode === 'step') {
      const idx = items.findIndex(i => i.id === first?.id)
      if (idx >= 0) setStepIndex(idx)
      return
    }
    if (first && itemRefs.current[first.id]) {
      itemRefs.current[first.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleSubmit = async () => {
    if (isPreview) {
      toast.info('Preview mode — submission disabled')
      return
    }
    if (!allAnswered) {
      setHighlightUnanswered(true)
      scrollToFirstUnanswered()
      toast.warning(`${unansweredItems.length} question${unansweredItems.length > 1 ? 's' : ''} still need an answer`, {
        description: 'Highlighted in orange below.',
        duration: 4000,
      })
      return
    }
    if (!questionnaire || !userId) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const maxItemScore = scale ? getMaxItemScore(scale) : 3

      // ── Build response records ─────────────────────────────────────────────
      const responseRecords = items.map(item => {
        const rawValue = responses[item.id] ?? 0
        const weight = item.scoring_weight ?? 1
        const scoredValue = item.is_reverse_scored
          ? (maxItemScore - rawValue) * weight
          : rawValue * weight

        let flagTriggered = false
        let flagMessage: string | null = null
        if (
          item.is_clinical_flag_item &&
          item.clinical_flag_threshold !== null &&
          item.clinical_flag_operator === 'gte' &&
          rawValue >= item.clinical_flag_threshold
        ) {
          flagTriggered = true
          flagMessage = item.clinical_flag_message
        }

        return {
          questionnaire_id: qid,
          participant_id: userId,
          item_id: item.id,
          raw_response: String(rawValue),
          raw_response_numeric: rawValue,
          scored_value: scoredValue,
          is_reverse_scored: item.is_reverse_scored,
          is_skipped: false,
          clinical_flag_triggered: flagTriggered,
          clinical_flag_message: flagMessage,
          submitted_at: new Date().toISOString(),
        }
      })

      // ── Compute score ──────────────────────────────────────────────────────
      const totalScore = responseRecords.reduce((sum, r) => sum + r.scored_value, 0)
      const totalPossible = items.length * maxItemScore
      const severityBand = scale ? getSeverityBand(scale, totalScore) : null

      const totalAlertFired =
        questionnaire.clinical_alert_enabled &&
        questionnaire.clinical_alert_threshold !== null &&
        totalScore >= questionnaire.clinical_alert_threshold

      const itemFlags = responseRecords.filter(r => r.clinical_flag_triggered)
      const anyAlertFired = totalAlertFired || itemFlags.length > 0

      const scoredPayload = {
        questionnaire_id: qid,
        participant_id: userId,
        total_score: totalScore,
        total_score_possible: totalPossible,
        score_percentage: totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0,
        severity_label: severityBand?.label ?? null,
        severity_category: severityBand?.category ?? null,
        items_completed: items.length,
        items_total: items.length,
        completion_percentage: 100,
        is_complete: true,
        clinical_alert_triggered: anyAlertFired,
        clinical_alert_level: anyAlertFired
          ? (itemFlags.length > 0 ? 'critical' : 'high')
          : null,
        scored_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      }

      let alertPayload: object | null = null
      if (anyAlertFired) {
        const alertLevel = itemFlags.length > 0 ? 'critical' : 'high'
        const alertType = itemFlags.length > 0 ? 'item_level_flag' : 'total_score_threshold'
        alertPayload = {
          study_id: questionnaire.study_id,
          questionnaire_id: qid,
          participant_id: userId,
          alert_level: alertLevel,
          alert_type: alertType,
          trigger_description: itemFlags.length > 0
            ? (itemFlags[0].clinical_flag_message ?? 'Critical item endorsed. Immediate review required.')
            : `Total score of ${totalScore} meets or exceeds the alert threshold of ${questionnaire.clinical_alert_threshold}.`,
          trigger_score: totalScore,
          trigger_threshold: questionnaire.clinical_alert_threshold ?? 0,
          scale_name: questionnaire.validated_scale_name ?? 'Unknown',
          acknowledged: false,
          resolved: false,
          escalated: false,
        }
      }

      // ── Submit via server route (bypasses RLS) ─────────────────────────────
      const submitRes = await fetch(`/api/questionnaire/${qid}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseRecords, scoredPayload, alertPayload }),
      })

      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({ error: 'Unknown server error' }))
        throw new Error(err.error ?? 'Could not save score')
      }

      setScore(totalScore)
      setSeverity(severityBand)
      setClinicalFlagged(anyAlertFired)
      setSubmitted(true)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error. Please try again.'
      setSubmitError(msg)
      toast.error('Submission failed', { description: msg, duration: 8000 })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Shared item renderer (used by both list and step modes) ─────────────────

  function renderQuestion(item: QuestionnaireItem, index: number) {
    const selected = responses[item.id]
    const hasValue = selected !== undefined
    const isUnanswered = highlightUnanswered && !hasValue

    const options: ResponseOption[] =
      item.response_options?.length > 0
        ? item.response_options
        : (scale?.response_options ?? [])

    const flagActive =
      item.is_clinical_flag_item && (
        everFlaggedItems.has(item.id) ||
        (hasValue &&
          item.clinical_flag_threshold !== null &&
          item.clinical_flag_operator === 'gte' &&
          selected >= item.clinical_flag_threshold)
      )

    return (
      <div
        key={item.id}
        ref={el => { itemRefs.current[item.id] = el }}
        className={cn(
          'space-y-3 rounded-xl p-4 -mx-4 transition-colors',
          isUnanswered ? 'bg-accent/10 border border-accent/30' : 'border border-transparent'
        )}
      >
        {/* Question */}
        <div className="flex gap-3">
          <span className={cn(
            'text-sm font-mono w-6 shrink-0 pt-0.5',
            isUnanswered ? 'text-accent font-bold' : 'text-muted-foreground'
          )}>
            {index + 1}.
          </span>
          <p className="text-base text-foreground leading-relaxed">{item.item_text}</p>
        </div>

        {/* Response options */}
        {options.length > 0 ? (
          <div className="ml-9 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleResponse(item.id, opt.value)}
                className={cn(
                  'border rounded-lg px-3 py-2.5 text-sm text-center transition-all',
                  hasValue && selected === opt.value
                    ? 'border-primary bg-primary text-primary-foreground font-medium'
                    : isUnanswered
                      ? 'border-accent/40 bg-card hover:border-primary hover:bg-primary/5'
                      : 'border-border bg-background hover:border-primary hover:bg-primary/5'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="ml-9 text-sm text-destructive">
            No response options configured. Contact your researcher.
          </p>
        )}

        {/* Clinical flag warning */}
        {flagActive && (
          <div className="ml-9 flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive leading-relaxed">
              If you are having thoughts of hurting yourself, please reach out to a
              mental health professional or call a crisis helpline immediately.
            </p>
          </div>
        )}
      </div>
    )
  }

  // ─── Render states ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">Loading questionnaire...</p>
      </div>
    )
  }

  // Consent gate — items are already loaded; only display is gated
  if (needsConsent && studyId) {
    return (
      <ConsentScreen
        studyId={studyId}
        consentText={consentText}
        onConsent={() => setNeedsConsent(false)}
      />
    )
  }

  if (!questionnaire) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="font-serif text-xl mb-2">Questionnaire not found.</p>
        <p className="text-sm text-muted-foreground">The link may be invalid or the questionnaire has been removed.</p>
      </div>
    )
  }

  if (items.length === 0 && !submitted) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="font-serif text-xl mb-2">No questions found.</p>
        <p className="text-sm text-muted-foreground">This questionnaire has no active items. Contact your researcher.</p>
      </div>
    )
  }

  // ─── Completion screen ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <CheckCircle
          className="w-12 h-12 mx-auto mb-4"
          style={{ color: showScoreToParticipant && severity?.color ? severity.color : '#86C99A' }}
        />
        <h1 className="font-serif text-2xl mb-2">All done. Thank you.</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Your responses have been recorded and shared with your researcher.
        </p>

        {/* Numeric score + severity band are only shown when the researcher has
            explicitly enabled participant-facing results for this instrument.
            Otherwise participants see supportive, non-diagnostic language. */}
        {showScoreToParticipant && scale && severity && (
          <>
            <div
              className="inline-block border rounded-xl px-8 py-5 mb-4"
              style={{ borderColor: severity.color, backgroundColor: severity.color + '18' }}
            >
              <p className="text-3xl font-serif font-bold" style={{ color: severity.color }}>
                {score} / {scale.scale_max}
              </p>
              <p className="text-sm mt-1 font-medium" style={{ color: severity.color }}>
                {severity.label}
              </p>
            </div>

            <div className="max-w-sm mx-auto mb-6 text-left border border-border rounded-xl p-4 text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground text-sm">Score ranges for {scale.abbreviation}</p>
              {scale.severity_bands.map(b => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} aria-label={b.label} />
                  <span className="text-foreground">{b.label}</span>
                  <span className="ml-auto">{b.min}–{b.max}</span>
                  {b.label === severity.label && <span className="text-xs font-bold" style={{ color: b.color }}>← you</span>}
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed mb-6">
          {showScoreToParticipant
            ? 'Scores reflect patterns — not your identity or fixed traits. If you are concerned about your wellbeing, please speak with your researcher or a mental health professional.'
            : 'Thank you for taking the time to answer honestly. Your researcher will review the results. If anything came up for you while answering, please reach out to your researcher or a mental health professional.'}
        </p>

        {clinicalFlagged && (
          <div className="mt-6 text-left">
            <CrisisResources />
          </div>
        )}

        <div className="mt-8">
          <Button variant="outline" onClick={() => router.push('/participant/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  // ─── Survey form ─────────────────────────────────────────────────────────────

  const stepItem = items[stepIndex]
  const isLastStep = stepIndex === items.length - 1

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {isPreview && (
        <div className="mb-6 flex items-center justify-between gap-3 border border-accent/40 bg-accent/10 rounded-xl px-4 py-3 text-sm text-foreground">
          <div>
            <strong>Preview mode</strong> — answers won&apos;t be saved. Use this to sanity-check the questionnaire.
          </div>
          <Button variant="outline" size="sm" onClick={() => router.back()}>End preview</Button>
        </div>
      )}

      {/* Resume banner */}
      {resumed && !isPreview && (
        <div className="mb-6 flex items-start gap-2.5 border border-primary/20 bg-primary/5 rounded-xl px-4 py-3 text-sm text-foreground">
          <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            <strong>Welcome back.</strong> We saved your progress — you can pick up right where you left off.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-serif text-2xl text-foreground mb-2">{questionnaire.title}</h1>
          {/* View mode toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0 mt-1">
            <button
              onClick={() => setViewMode('step')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors', viewMode === 'step' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
              title="One question at a time"
            >
              <Square className="w-3 h-3" /> One
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors', viewMode === 'all' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
              title="Show all questions"
            >
              <Rows3 className="w-3 h-3" /> All
            </button>
          </div>
        </div>
        {questionnaire.instructions && (
          <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-border pl-3">
            {questionnaire.instructions}
          </p>
        )}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{answeredCount} of {totalItems} answered</span>
            <span className="flex items-center gap-2">
              {saveStatus === 'saving' && <span className="text-xs opacity-70">Saving…</span>}
              {saveStatus === 'saved' && (
                <span className="text-xs inline-flex items-center gap-0.5" style={{ color: '#86C99A' }}>
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
              <span>{Math.round(progress)}%</span>
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Jump to unanswered banner */}
      {highlightUnanswered && unansweredItems.length > 0 && (
        <button
          onClick={scrollToFirstUnanswered}
          className="w-full mb-6 flex items-center justify-between gap-3 border border-accent/40 bg-accent/10 rounded-xl px-4 py-3 text-sm text-foreground hover:bg-accent/15 transition-colors"
        >
          <span>
            <strong>{unansweredItems.length}</strong> question{unansweredItems.length > 1 ? 's' : ''} still need{unansweredItems.length === 1 ? 's' : ''} an answer
          </span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </button>
      )}

      {/* ── STEP MODE: one question at a time ── */}
      {viewMode === 'step' && stepItem ? (
        <div>
          <p className="text-sm text-muted-foreground mb-3">Question {stepIndex + 1} of {items.length}</p>
          <div className="min-h-[180px]">
            {renderQuestion(stepItem, stepIndex)}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setStepIndex(i => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>

            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                variant={allAnswered ? 'default' : 'outline'}
                className="flex-1"
              >
                {submitting ? 'Submitting…' : allAnswered ? 'Submit responses' : `${totalItems - answeredCount} unanswered`}
              </Button>
            ) : (
              <Button
                onClick={() => setStepIndex(i => Math.min(items.length - 1, i + 1))}
                className="gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Dot indicators */}
          <div className="mt-6 flex flex-wrap gap-1.5 justify-center">
            {items.map((it, i) => {
              const answered = responses[it.id] !== undefined
              return (
                <button
                  key={it.id}
                  onClick={() => setStepIndex(i)}
                  aria-label={`Go to question ${i + 1}`}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    i === stepIndex ? 'ring-2 ring-offset-1 ring-primary' : '',
                  )}
                  style={{ background: answered ? '#86C99A' : 'var(--muted)' }}
                />
              )
            })}
          </div>
        </div>
      ) : (
        /* ── LIST MODE: all questions ── */
        <>
          <div className="space-y-10">
            {items.map((item, index) => renderQuestion(item, index))}
          </div>

          {/* Submit */}
          <div className="mt-12 pb-8 space-y-3">
            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-0.5">Submission failed</p>
                  <p className="leading-relaxed">{submitError}</p>
                  <p className="mt-1 opacity-70">Your answers are still selected. Please try again.</p>
                </div>
              </div>
            )}

            {!allAnswered && totalItems > 0 && !highlightUnanswered && (
              <p className="text-sm text-muted-foreground text-center">
                {totalItems - answeredCount} question{totalItems - answeredCount > 1 ? 's' : ''} remaining
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
              size="lg"
              variant={allAnswered ? 'default' : 'outline'}
            >
              {submitting
                ? 'Submitting…'
                : allAnswered
                  ? 'Submit responses'
                  : `Show ${totalItems - answeredCount} unanswered question${totalItems - answeredCount > 1 ? 's' : ''}`}
            </Button>
          </div>
        </>
      )}

      {/* Submit error in step mode */}
      {viewMode === 'step' && submitError && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-0.5">Submission failed</p>
            <p className="leading-relaxed">{submitError}</p>
          </div>
        </div>
      )}

      {/* Save & finish later — answers autosave, so leaving is safe */}
      {!isPreview && answeredCount > 0 && !allAnswered && (
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/participant/dashboard')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" style={{ color: '#86C99A' }} />
            Save &amp; finish later
          </button>
        </div>
      )}
    </div>
  )
}
