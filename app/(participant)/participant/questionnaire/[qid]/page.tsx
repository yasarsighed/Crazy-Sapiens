'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
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
import { CheckCircle, AlertTriangle, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { ConsentScreen } from '@/components/consent-screen'

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
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuestionnairePage() {
  const params = useParams()
  const qid = params.qid as string

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
  const [userId, setUserId] = useState<string | null>(null)
  // Consent gate
  const [needsConsent, setNeedsConsent] = useState(false)
  const [consentText, setConsentText] = useState<string | null>(null)
  const [studyId, setStudyId] = useState<string | null>(null)
  // Permanent flag tracking: once an item exceeds threshold, keeps showing warning
  const [everFlaggedItems, setEverFlaggedItems] = useState<Set<string>>(new Set())
  // Highlight unanswered items after failed submit attempt
  const [highlightUnanswered, setHighlightUnanswered] = useState(false)
  // Refs for scrolling to first unanswered item
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // ── Load questionnaire instrument ─────────────────────────────────────
      const { data: q } = await supabase
        .from('questionnaire_instruments')
        .select('id, study_id, title, instructions, validated_scale_name, is_validated_scale, clinical_alert_enabled, clinical_alert_threshold')
        .eq('id', qid)
        .single()

      if (!q) { setLoading(false); return }
      setQuestionnaire(q)
      setStudyId(q.study_id)

      // ── Match built-in scale ──────────────────────────────────────────────
      let matchedScale: BuiltInScale | null = null
      if (q.validated_scale_name) {
        matchedScale = BUILT_IN_SCALES.find(s => s.abbreviation === q.validated_scale_name) ?? null
        if (matchedScale) setScale(matchedScale)
      }

      // ── Check consent (non-blocking — fail open so DB column absence doesn't lock participants) ──
      try {
        const { data: enrollment } = await supabase
          .from('study_enrollments')
          .select('consented_at')
          .eq('study_id', q.study_id)
          .eq('participant_id', user.id)
          .maybeSingle()

        if (!enrollment?.consented_at) {
          const { data: studyData } = await supabase
            .from('studies')
            .select('consent_text')
            .eq('id', q.study_id)
            .single()
          setConsentText(studyData?.consent_text ?? null)
          setNeedsConsent(true)
          // NOTE: we do NOT return here — items are loaded below regardless.
          // Consent gates only the *display*, not the data fetch.
        }
      } catch {
        // Column may not exist yet — treat as consented (fail open)
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
      setLoading(false)
    }
    load()
  }, [qid])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleResponse = (itemId: string, value: number) => {
    setResponses(prev => ({ ...prev, [itemId]: value }))
    setHighlightUnanswered(false) // reset highlight when user answers

    // Permanent clinical flag tracking
    const item = items.find(i => i.id === itemId)
    if (
      item?.is_clinical_flag_item &&
      item.clinical_flag_threshold !== null &&
      item.clinical_flag_operator === 'gte' &&
      value >= item.clinical_flag_threshold
    ) {
      setEverFlaggedItems(prev => new Set([...prev, itemId]))
    }
  }

  const answeredCount = Object.keys(responses).length
  const totalItems = items.length
  const progress = totalItems > 0 ? (answeredCount / totalItems) * 100 : 0
  const allAnswered = answeredCount === totalItems && totalItems > 0
  const unansweredItems = items.filter(i => responses[i.id] === undefined)

  const scrollToFirstUnanswered = () => {
    const first = unansweredItems[0]
    if (first && itemRefs.current[first.id]) {
      itemRefs.current[first.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleSubmit = async () => {
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
      const supabase = createClient()
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

      // ── Save item responses ────────────────────────────────────────────────
      // Strategy: try upsert with onConflict first (needs DB unique constraint).
      // If constraint missing, fall back to plain INSERT — the already-submitted
      // guard at page load prevents true duplicates in normal flow.
      let responseError: any = null

      const upsertResult = await supabase
        .from('questionnaire_item_responses')
        .upsert(responseRecords, {
          onConflict: 'questionnaire_id,participant_id,item_id',
          ignoreDuplicates: false,
        })
      responseError = upsertResult.error

      if (responseError) {
        if (responseError.message?.includes('unique constraint') || responseError.code === '42P10') {
          // Constraint doesn't exist — fall back to INSERT
          const insertResult = await supabase
            .from('questionnaire_item_responses')
            .insert(responseRecords)
          responseError = insertResult.error
        }
      }

      if (responseError) throw new Error(`Could not save responses: ${responseError.message}`)

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

      // ── Save scored result ─────────────────────────────────────────────────
      // Try upsert with onConflict, fall back to INSERT
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

      let scoredResult: any = null
      let scoreError: any = null

      const upsertScore = await supabase
        .from('questionnaire_scored_results')
        .upsert(scoredPayload, { onConflict: 'questionnaire_id,participant_id' })
        .select('id')
        .single()

      if (upsertScore.error) {
        if (upsertScore.error.message?.includes('unique constraint') || upsertScore.error.code === '42P10') {
          const insertScore = await supabase
            .from('questionnaire_scored_results')
            .insert(scoredPayload)
            .select('id')
            .single()
          scoredResult = insertScore.data
          scoreError = insertScore.error
        } else {
          scoreError = upsertScore.error
        }
      } else {
        scoredResult = upsertScore.data
      }

      if (scoreError) throw new Error(`Could not save score: ${scoreError.message}`)

      // ── Fire clinical alert ────────────────────────────────────────────────
      if (anyAlertFired && scoredResult) {
        const alertLevel = itemFlags.length > 0 ? 'critical' : 'high'
        const alertType = itemFlags.length > 0 ? 'item_level_flag' : 'total_score_threshold'
        const triggerDescription =
          itemFlags.length > 0
            ? (itemFlags[0].clinical_flag_message ?? 'Critical item endorsed. Immediate review required.')
            : `Total score of ${totalScore} meets or exceeds the alert threshold of ${questionnaire.clinical_alert_threshold}.`

        // Non-fatal — alert insert failure does not block completion
        await supabase.from('clinical_alerts_log').insert({
          study_id: questionnaire.study_id,
          questionnaire_id: qid,
          participant_id: userId,
          scored_result_id: scoredResult.id,
          alert_level: alertLevel,
          alert_type: alertType,
          trigger_description: triggerDescription,
          trigger_score: totalScore,
          trigger_threshold: questionnaire.clinical_alert_threshold ?? 0,
          scale_name: questionnaire.validated_scale_name ?? 'Unknown',
          acknowledged: false,
          resolved: false,
          escalated: false,
        }).then(() => {}).catch(() => {})
      }

      setScore(totalScore)
      setSeverity(severityBand)
      setSubmitted(true)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error. Please try again.'
      setSubmitError(msg)
      toast.error('Submission failed', { description: msg, duration: 8000 })
    } finally {
      setSubmitting(false)
    }
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
          style={{ color: severity?.color ?? '#52B788' }}
        />
        <h1 className="font-serif text-2xl mb-2">All done. Thank you.</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Your responses have been recorded and shared with your researcher.
        </p>

        {scale && severity && (
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
        )}

        {scale && severity && (
          <div className="max-w-sm mx-auto mb-6 text-left border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground text-sm">Score ranges for {scale.abbreviation}</p>
            {scale.severity_bands.map(b => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} aria-label={b.label} />
                <span className="text-foreground">{b.label}</span>
                <span className="ml-auto">{b.min}–{b.max}</span>
                {b.label === severity.label && <span className="text-[10px] font-bold" style={{ color: b.color }}>← you</span>}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Scores reflect patterns — not your identity or fixed traits. If you are concerned about
          your wellbeing, please speak with your researcher or a mental health professional.
        </p>
      </div>
    )
  }

  // ─── Survey form ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground mb-2">{questionnaire.title}</h1>
        {questionnaire.instructions && (
          <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-border pl-3">
            {questionnaire.instructions}
          </p>
        )}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{answeredCount} of {totalItems} answered</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Jump to unanswered banner */}
      {highlightUnanswered && unansweredItems.length > 0 && (
        <button
          onClick={scrollToFirstUnanswered}
          className="w-full mb-6 flex items-center justify-between gap-3 border border-amber-300 bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <span>
            <strong>{unansweredItems.length}</strong> question{unansweredItems.length > 1 ? 's' : ''} still need{unansweredItems.length === 1 ? 's' : ''} an answer
          </span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </button>
      )}

      {/* Items */}
      <div className="space-y-10">
        {items.map((item, index) => {
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
                isUnanswered ? 'bg-amber-50 border border-amber-200' : 'border border-transparent'
              )}
            >
              {/* Question */}
              <div className="flex gap-3">
                <span className={cn(
                  'text-sm font-mono w-6 shrink-0 pt-0.5',
                  isUnanswered ? 'text-amber-600 font-bold' : 'text-muted-foreground'
                )}>
                  {index + 1}.
                </span>
                <p className="text-sm text-foreground leading-relaxed">{item.item_text}</p>
              </div>

              {/* Response options */}
              {options.length > 0 ? (
                <div className="ml-9 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {options.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleResponse(item.id, opt.value)}
                      className={cn(
                        'border rounded-lg px-3 py-2.5 text-xs text-center transition-all',
                        hasValue && selected === opt.value
                          ? 'border-primary bg-primary text-primary-foreground font-medium'
                          : isUnanswered
                            ? 'border-amber-300 bg-white hover:border-primary hover:bg-primary/5'
                            : 'border-border bg-background hover:border-primary hover:bg-primary/5'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="ml-9 text-xs text-destructive">
                  No response options configured. Contact your researcher.
                </p>
              )}

              {/* Clinical flag warning */}
              {flagActive && (
                <div className="ml-9 flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive leading-relaxed">
                    If you are having thoughts of hurting yourself, please reach out to a
                    mental health professional or call a crisis helpline immediately.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit */}
      <div className="mt-12 pb-8 space-y-3">
        {submitError && (
          <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-xs text-destructive">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-0.5">Submission failed</p>
              <p className="leading-relaxed">{submitError}</p>
              <p className="mt-1 opacity-70">Your answers are still selected. Please try again.</p>
            </div>
          </div>
        )}

        {!allAnswered && totalItems > 0 && !highlightUnanswered && (
          <p className="text-xs text-muted-foreground text-center">
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
    </div>
  )
}
