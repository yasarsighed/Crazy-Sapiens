'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CheckCircle, Search, Users, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { ConsentScreen } from '@/components/consent-screen'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SociogramConfig {
  id: string
  study_id: string
  title: string
  instructions: string | null
  min_nominations: number
  max_nominations: number
  allow_self_nomination: boolean
  relationship_scale_min: number | null
  relationship_scale_max: number | null
  scale_label_low: string | null
  scale_label_high: string | null
}

interface RelationshipType {
  id: string
  label: string
  description: string | null
  color_hex: string
  is_negative_dimension: boolean
  display_order: number
}

interface SociogramParticipant {
  id: string
  participant_id: string
  display_name: string
  anonymised_label: string | null
}

type NominationState = Record<
  string, // relationship_type_id
  {
    nominees: Set<string> // sociogram_participants.id
    scores: Record<string, number> // sociogram_participants.id → score
  }
>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SociogramNominationPage() {
  const params = useParams()
  const sid = params.sid as string

  const [config, setConfig] = useState<SociogramConfig | null>(null)
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([])
  const [participants, setParticipants] = useState<SociogramParticipant[]>([])
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null)
  const [nominations, setNominations] = useState<NominationState>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null)
  const [needsConsent, setNeedsConsent] = useState(false)
  const [consentText, setConsentText] = useState<string | null>(null)
  const [studyId, setStudyId] = useState<string | null>(null)
  const [restoredDraft, setRestoredDraft] = useState(false)
  const [draftKey, setDraftKey] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Load sociogram config
      const { data: cfg } = await supabase
        .from('sociogram_instruments')
        .select(
          'id, study_id, title, instructions, min_nominations, max_nominations, allow_self_nomination, relationship_scale_min, relationship_scale_max, scale_label_low, scale_label_high'
        )
        .eq('id', sid)
        .single()

      if (!cfg) { setLoading(false); return }
      setConfig(cfg)
      setStudyId(cfg.study_id)

      // Consent check
      const { data: enrollment } = await supabase
        .from('study_enrollments')
        .select('consented_at')
        .eq('study_id', cfg.study_id)
        .eq('participant_id', user.id)
        .maybeSingle()

      if (!enrollment?.consented_at) {
        const { data: studyData } = await supabase
          .from('studies')
          .select('consent_text')
          .eq('id', cfg.study_id)
          .single()
        setConsentText(studyData?.consent_text ?? null)
        setNeedsConsent(true)
        setLoading(false)
        return
      }

      // Load active relationship types
      const { data: types } = await supabase
        .from('sociogram_relationship_types')
        .select('id, label, description, color_hex, is_negative_dimension, display_order')
        .eq('sociogram_id', sid)
        .eq('is_active', true)
        .order('display_order')

      const loadedTypes = types ?? []
      setRelationshipTypes(loadedTypes)

      // Initialise empty nomination state
      const initialNominations: NominationState = {}
      loadedTypes.forEach(t => {
        initialNominations[t.id] = { nominees: new Set(), scores: {} }
      })
      setNominations(initialNominations)

      // Find current user's sociogram_participant record
      let { data: myRecord } = await supabase
        .from('sociogram_participants')
        .select('id, has_submitted')
        .eq('sociogram_id', sid)
        .eq('participant_id', user.id)
        .single()

      if (myRecord?.has_submitted) {
        setSubmitted(true)
        setLoading(false)
        return
      }

      // Auto-enroll: if no record exists yet, create one
      if (!myRecord) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single()

        const displayName = profile?.full_name ?? profile?.email ?? user.id

        const { data: newRecord, error: enrollErr } = await supabase
          .from('sociogram_participants')
          .insert({
            sociogram_id:    sid,
            participant_id:  user.id,
            display_name:    displayName,
            is_active:       true,
            has_submitted:   false,
          })
          .select('id')
          .single()

        if (enrollErr) {
          console.error('Auto-enroll failed:', enrollErr.message)
          // Most likely cause: missing RLS INSERT policy on sociogram_participants.
          // The researcher needs to run the RLS SQL fix in Supabase.
          setEnrollmentError(
            'Could not register you for this sociogram. ' +
            'Please ask your researcher to add you directly, or try refreshing the page.'
          )
          setLoading(false)
          return
        }
        myRecord = newRecord
      }

      if (!myRecord?.id) {
        setEnrollmentError('Your participant record could not be found. Please try refreshing.')
        setLoading(false)
        return
      }

      setMyParticipantId(myRecord.id)

      // Load all other participants to nominate from
      const { data: allParticipants } = await supabase
        .from('sociogram_participants')
        .select('id, participant_id, display_name, anonymised_label')
        .eq('sociogram_id', sid)
        .eq('is_active', true)

      // Exclude self if not allowed
      const filtered = (allParticipants ?? []).filter(p =>
        cfg.allow_self_nomination || p.participant_id !== user.id
      )
      setParticipants(filtered)

      // Restore an in-progress draft from localStorage, if one exists — a
      // sociogram can involve up to (types × max_nominations) selections
      // (e.g. 6 types × 5 = 30 people to pick), and there was previously no
      // way to recover that work after a refresh, tab close, or session
      // hiccup, unlike questionnaires which autosave server-side. Kept
      // client-only (no new API/schema) since it only needs to survive a
      // browser mishap, not sync across devices.
      const key = `sociogram_draft_${sid}_${user.id}`
      setDraftKey(key)
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const draft = JSON.parse(raw) as Record<string, { nominees: string[]; scores: Record<string, number> }>
          const validParticipantIds = new Set(filtered.map(p => p.id))
          let restoredAny = false
          const restored: NominationState = {}
          loadedTypes.forEach(t => {
            const d = draft[t.id]
            const nomineeIds = (d?.nominees ?? []).filter(id => validParticipantIds.has(id))
            if (nomineeIds.length > 0) restoredAny = true
            restored[t.id] = {
              nominees: new Set(nomineeIds),
              scores: Object.fromEntries(
                Object.entries(d?.scores ?? {}).filter(([pid]) => nomineeIds.includes(pid)),
              ),
            }
          })
          if (restoredAny) {
            setNominations(restored)
            setRestoredDraft(true)
          }
        }
      } catch {
        // Corrupt/unparseable draft — ignore and start fresh rather than crash the page.
      }

      setLoading(false)
    }
    load()
  }, [sid])

  // Persist the in-progress draft on every change (debounced by React's own
  // batching — this is cheap, localStorage writes aren't a performance
  // concern at this data size). Cleared on successful submit.
  useEffect(() => {
    if (!draftKey || loading) return
    const hasAny = Object.values(nominations).some(v => v.nominees.size > 0)
    if (!hasAny) { localStorage.removeItem(draftKey); return }
    const serializable = Object.fromEntries(
      Object.entries(nominations).map(([typeId, v]) => [typeId, { nominees: [...v.nominees], scores: v.scores }]),
    )
    try { localStorage.setItem(draftKey, JSON.stringify(serializable)) } catch { /* storage full/unavailable — non-fatal */ }
  }, [nominations, draftKey, loading])

  // ─── Nomination handlers ─────────────────────────────────────────────────────

  const toggleNominee = (typeId: string, participantId: string) => {
    setNominations(prev => {
      const typeState = prev[typeId]
      const newNominees = new Set(typeState.nominees)
      const newScores = { ...typeState.scores }

      if (newNominees.has(participantId)) {
        newNominees.delete(participantId)
        delete newScores[participantId]
      } else if (newNominees.size < (config?.max_nominations ?? Infinity)) {
        newNominees.add(participantId)
        // Default to middle score if scale enabled
        if (config?.relationship_scale_min !== null) {
          newScores[participantId] = 3
        }
      }

      return { ...prev, [typeId]: { nominees: newNominees, scores: newScores } }
    })
  }

  const setScore = (typeId: string, participantId: string, score: number) => {
    setNominations(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        scores: { ...prev[typeId].scores, [participantId]: score },
      },
    }))
  }

  const completedCount = relationshipTypes.filter(
    t => (nominations[t.id]?.nominees.size ?? 0) >= (config?.min_nominations ?? 1)
  ).length

  const progress =
    relationshipTypes.length > 0 ? (completedCount / relationshipTypes.length) * 100 : 0

  const scaleEnabled =
    config?.relationship_scale_min !== null && config?.relationship_scale_min !== undefined

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!config || !userId) return

    // Hard guard: participant record must exist before we can write nominations
    if (!myParticipantId) {
      toast.error('Registration incomplete', {
        description: 'Your participant record could not be found. Please refresh and try again.',
      })
      return
    }

    setSubmitting(true)

    try {
      const supabase = createClient()
      const now = new Date().toISOString()

      // Verify participant record still exists — prevents FK violation if record was deleted
      const { data: verifyRecord } = await supabase
        .from('sociogram_participants')
        .select('id')
        .eq('id', myParticipantId)
        .single()

      if (!verifyRecord) {
        throw new Error('Your participant record no longer exists. Please refresh the page.')
      }

      // Build a lookup from sociogram_participants.id → auth user id
      // The FK on nominator_id/nominee_id references auth.users(id), not sociogram_participants(id)
      const authIdBySocId: Record<string, string> = {}
      for (const p of participants) {
        authIdBySocId[p.id] = p.participant_id  // participant_id = auth.users.id
      }
      // Include self (current user) in the map
      if (myParticipantId) authIdBySocId[myParticipantId] = userId

      const allNominations: object[] = []
      for (const type of relationshipTypes) {
        const typeState = nominations[type.id]
        for (const nomineeId of typeState.nominees) {
          const nomineeAuthId = authIdBySocId[nomineeId]
          if (!nomineeAuthId) continue  // skip if we can't resolve auth id
          allNominations.push({
            sociogram_id: sid,
            nominator_id: userId,           // auth.users.id of current user
            nominee_id: nomineeAuthId,       // auth.users.id of nominee
            relationship_type_id: type.id,
            score: typeState.scores[nomineeId] ?? null,
            is_negative_tie: type.is_negative_dimension,
            is_valid: true,
            nomination_round: 1,
            submitted_at: now,
          })
        }
      }

      // Safety filter: never insert self-nominations (guard against DB constraint)
      const safeNominations = allNominations.filter(
        (n: any) => n.nominator_id !== n.nominee_id
      )

      if (safeNominations.length > 0) {
        const { error: nomError } = await supabase
          .from('sociogram_nominations')
          .insert(safeNominations)
        if (nomError) throw new Error(`Nominations failed: ${nomError.message}`)
      }

      // Mark participant as submitted
      const { error: updateError } = await supabase
        .from('sociogram_participants')
        .update({ has_submitted: true, submitted_at: now })
        .eq('id', myParticipantId)

      if (updateError) throw new Error(updateError.message)

      if (draftKey) { try { localStorage.removeItem(draftKey) } catch { /* non-fatal */ } }
      setSubmitted(true)
    } catch (err) {
      toast.error('Submission failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Filtered participant list ────────────────────────────────────────────────

  const filteredParticipants = participants.filter(p => {
    const name = p.anonymised_label ?? p.display_name
    return name.toLowerCase().includes(search.toLowerCase())
  })

  // ─── Render states ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading…</p>
      </div>
    )
  }

  if (needsConsent && studyId) {
    return (
      <ConsentScreen
        studyId={studyId}
        consentText={consentText}
        onConsent={() => {
          setNeedsConsent(false)
          // Re-trigger load by refreshing (simplest since load is idempotent)
          window.location.reload()
        }}
      />
    )
  }

  if (enrollmentError) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center animate-slide-up">
        <div className="rounded-3xl bg-card/80 backdrop-blur-sm border border-border shadow-sm p-10">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-destructive" />
          </div>
          <p className="font-serif text-xl font-semibold text-foreground mb-2">Registration error</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {enrollmentError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 text-sm font-medium underline text-primary hover:opacity-80 transition-opacity"
          >
            Refresh page
          </button>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center animate-slide-up">
        <div className="rounded-3xl bg-card/80 backdrop-blur-sm border border-border shadow-sm p-10">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-muted-foreground/60" />
          </div>
          <p className="font-serif text-xl font-semibold text-foreground mb-2">Sociogram not found.</p>
          <p className="text-sm text-muted-foreground">The link may be invalid.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center animate-slide-up">
        <div className="rounded-3xl overflow-hidden bg-card/80 backdrop-blur-sm border border-border shadow-sm">
          <div className="px-8 pt-10 pb-8" style={{ background: 'color-mix(in srgb, #86C99A 12%, var(--card))' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #86C99A, #C6A8F0)' }}>
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-foreground mb-2">All done — thank you.</h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Your nominations have been recorded. Your researcher will use these to map the
              network structure of your group.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Nomination form ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 animate-slide-up">
      {/* Header */}
      <div className="mb-6 rounded-3xl overflow-hidden bg-card/80 backdrop-blur-sm border border-border shadow-sm">
        <div className="px-6 pt-6 pb-5" style={{ background: 'color-mix(in srgb, #86C99A 9%, var(--card))' }}>
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #86C99A, #C6A8F0)' }}>
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-xl font-bold text-foreground leading-tight">{config.title}</h1>
              {restoredDraft && (
                <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: '#86C99A' }}>
                  <RotateCcw className="w-3 h-3 shrink-0" />
                  Picked up where you left off.
                </div>
              )}
              {config.instructions && (
                <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{config.instructions}</p>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="relative shrink-0">
              <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
                <circle cx="20" cy="20" r="17" fill="none" stroke="var(--muted)" strokeWidth="5" />
                <circle
                  cx="20" cy="20" r="17" fill="none" stroke="#86C99A" strokeWidth="5"
                  strokeDasharray={2 * Math.PI * 17}
                  strokeDashoffset={2 * Math.PI * 17 - (progress / 100) * 2 * Math.PI * 17}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-foreground">{Math.round(progress)}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{completedCount}</span> of {relationshipTypes.length} relationship types completed
            </p>
          </div>
        </div>
      </div>

      {/* Tabs — one per relationship type */}
      {relationshipTypes.length > 0 && (
        <Tabs defaultValue={relationshipTypes[0].id}>
          <TabsList className="w-full h-auto flex flex-wrap gap-1.5 mb-6 bg-transparent p-0">
            {relationshipTypes.map(type => {
              const count = nominations[type.id]?.nominees.size ?? 0
              const done = count >= (config.min_nominations ?? 1)
              return (
                <TabsTrigger
                  key={type.id}
                  value={type.id}
                  className="text-xs font-semibold flex items-center gap-1.5 rounded-xl border px-3 py-2 data-[state=active]:shadow-sm transition-all"
                  style={{
                    borderColor: `color-mix(in srgb, ${type.color_hex} 45%, transparent)`,
                    color: 'var(--foreground)',
                    background: `color-mix(in srgb, ${type.color_hex} 10%, var(--card))`,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: type.color_hex }}
                  />
                  {type.label}
                  {done && <CheckCircle className="w-3 h-3" style={{ color: '#86C99A' }} />}
                  {count > 0 && !done && (
                    <span className="text-[10px] text-muted-foreground">({count})</span>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {relationshipTypes.map(type => {
            const typeState = nominations[type.id] ?? { nominees: new Set(), scores: {} }
            const selectedCount = typeState.nominees.size
            const isMaxed = selectedCount >= config.max_nominations

            return (
              <TabsContent key={type.id} value={type.id} className="space-y-4">
                {/* Tab description */}
                <div
                  className="p-4 rounded-2xl border"
                  style={{
                    borderColor: `color-mix(in srgb, ${type.color_hex} 35%, transparent)`,
                    background: `color-mix(in srgb, ${type.color_hex} 8%, var(--card))`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: type.color_hex }} />
                    <p className="font-serif font-bold text-sm text-foreground">{type.label}</p>
                  </div>
                  {type.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Select {config.min_nominations}–{config.max_nominations} people ·{' '}
                    <span className="font-semibold text-foreground">{selectedCount} selected</span>
                    {isMaxed && ' (maximum reached)'}
                  </p>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search participants…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-full bg-card/60 placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Participant list */}
                <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                  {filteredParticipants.length === 0 ? (
                    <div className="text-center py-10 text-sm text-muted-foreground rounded-2xl border border-dashed border-border">
                      <Users className="w-7 h-7 mx-auto mb-2 opacity-40" />
                      No participants found.
                    </div>
                  ) : (
                    filteredParticipants.map(participant => {
                      const isSelected = typeState.nominees.has(participant.id)
                      const disabled = !isSelected && isMaxed
                      const name = participant.anonymised_label ?? participant.display_name

                      return (
                        <div key={participant.id} className="space-y-2">
                          {/* Participant row */}
                          <button
                            onClick={() => !disabled && toggleNominee(type.id, participant.id)}
                            disabled={disabled}
                            className={cn(
                              'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                              disabled && !isSelected && 'opacity-40 cursor-not-allowed border-border',
                            )}
                            style={
                              isSelected
                                ? { borderColor: `color-mix(in srgb, ${type.color_hex} 55%, transparent)`, background: `color-mix(in srgb, ${type.color_hex} 12%, var(--card))` }
                                : disabled
                                  ? undefined
                                  : { borderColor: 'var(--border)' }
                            }
                          >
                            {/* Checkbox */}
                            <div
                              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors"
                              style={isSelected
                                ? { background: type.color_hex, border: `1px solid ${type.color_hex}` }
                                : { border: '2px solid var(--border)' }}
                            >
                              {isSelected && (
                                <svg
                                  className="w-3 h-3 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>

                            {/* Avatar */}
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
                              style={{ backgroundColor: type.color_hex }}
                            >
                              {name.charAt(0).toUpperCase()}
                            </div>

                            <span className="text-sm font-medium text-foreground">{name}</span>
                          </button>

                          {/* Strength rating — shown inline after selection */}
                          {isSelected && scaleEnabled && (
                            <div className="ml-16 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-10 shrink-0">
                                {config.scale_label_low ?? 'Weak'}
                              </span>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(val => {
                                  const active = typeState.scores[participant.id] === val
                                  return (
                                    <button
                                      key={val}
                                      onClick={() => setScore(type.id, participant.id, val)}
                                      className="w-8 h-8 rounded-lg text-xs font-bold border transition-colors"
                                      style={active
                                        ? { background: type.color_hex, borderColor: type.color_hex, color: 'white' }
                                        : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                                    >
                                      {val}
                                    </button>
                                  )
                                })}
                              </div>
                              <span className="text-xs text-muted-foreground w-12 shrink-0 text-right">
                                {config.scale_label_high ?? 'Strong'}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      )}

      {/* Submit */}
      <div className="mt-8 pb-8 space-y-3">
        {completedCount < relationshipTypes.length && (
          <p className="text-xs text-muted-foreground text-center">
            Complete all relationship types (at least {config.min_nominations} nomination each) to
            submit.
          </p>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!myParticipantId || completedCount < relationshipTypes.length || submitting}
          className="w-full rounded-xl shadow-md"
          size="lg"
        >
          {submitting ? 'Submitting...' : 'Submit nominations'}
        </Button>
      </div>
    </div>
  )
}
