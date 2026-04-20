'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CheckCircle, Search, Users } from 'lucide-react'
import { toast } from 'sonner'

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

        const { data: newRecord } = await supabase
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

        myRecord = newRecord
      }

      setMyParticipantId(myRecord?.id ?? null)

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
      setLoading(false)
    }
    load()
  }, [sid])

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
    if (!config || !myParticipantId || !userId) return
    setSubmitting(true)

    try {
      const supabase = createClient()
      const now = new Date().toISOString()

      const allNominations: object[] = []
      for (const type of relationshipTypes) {
        const typeState = nominations[type.id]
        for (const nomineeId of typeState.nominees) {
          allNominations.push({
            sociogram_id: sid,
            nominator_id: myParticipantId,
            nominee_id: nomineeId,
            relationship_type_id: type.id,
            score: typeState.scores[nomineeId] ?? null,
            is_negative_tie: type.is_negative_dimension,
            is_valid: true,
            nomination_round: 1,
            submitted_at: now,
          })
        }
      }

      if (allNominations.length > 0) {
        const { error: nomError } = await supabase
          .from('sociogram_nominations')
          .insert(allNominations)
        if (nomError) throw new Error(nomError.message)
      }

      // Mark participant as submitted
      const { error: updateError } = await supabase
        .from('sociogram_participants')
        .update({ has_submitted: true, submitted_at: now })
        .eq('id', myParticipantId)

      if (updateError) throw new Error(updateError.message)

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
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="font-serif text-xl mb-2">Sociogram not found.</p>
        <p className="text-sm text-muted-foreground">The link may be invalid.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-[#52B788]" />
        <h1 className="font-serif text-2xl mb-2">All done. Thank you.</h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Your nominations have been recorded. Your researcher will use these to map the
          network structure of your group.
        </p>
      </div>
    )
  }

  // ─── Nomination form ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-foreground mb-2">{config.title}</h1>
        {config.instructions && (
          <p className="text-sm text-muted-foreground leading-relaxed">{config.instructions}</p>
        )}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {completedCount} of {relationshipTypes.length} relationship types completed
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Tabs — one per relationship type */}
      {relationshipTypes.length > 0 && (
        <Tabs defaultValue={relationshipTypes[0].id}>
          <TabsList className="w-full flex-wrap h-auto gap-1 mb-6 bg-muted/50 p-1">
            {relationshipTypes.map(type => {
              const count = nominations[type.id]?.nominees.size ?? 0
              const done = count >= (config.min_nominations ?? 1)
              return (
                <TabsTrigger
                  key={type.id}
                  value={type.id}
                  className="text-xs flex items-center gap-1.5"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: type.color_hex }}
                  />
                  {type.label}
                  {done && <CheckCircle className="w-3 h-3 text-[#52B788]" />}
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
                  className="p-4 rounded-xl border-l-4"
                  style={{
                    borderColor: type.color_hex,
                    backgroundColor: type.color_hex + '12',
                  }}
                >
                  <p className="font-medium text-sm">{type.label}</p>
                  {type.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Select {config.min_nominations}–{config.max_nominations} people ·{' '}
                    <span className="font-medium">{selectedCount} selected</span>
                    {isMaxed && ' (maximum reached)'}
                  </p>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search participants..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Participant list */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredParticipants.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
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
                              'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : disabled
                                ? 'border-border opacity-40 cursor-not-allowed'
                                : 'border-border hover:border-primary hover:bg-primary/5'
                            )}
                          >
                            {/* Checkbox */}
                            <div
                              className={cn(
                                'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                                isSelected ? 'border-primary bg-primary' : 'border-border'
                              )}
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
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                              style={{ backgroundColor: type.color_hex }}
                            >
                              {name.charAt(0).toUpperCase()}
                            </div>

                            <span className="text-sm">{name}</span>
                          </button>

                          {/* Strength rating — shown inline after selection */}
                          {isSelected && scaleEnabled && (
                            <div className="ml-16 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-10 shrink-0">
                                {config.scale_label_low ?? 'Weak'}
                              </span>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(val => (
                                  <button
                                    key={val}
                                    onClick={() => setScore(type.id, participant.id, val)}
                                    className={cn(
                                      'w-8 h-8 rounded text-xs font-medium border transition-colors',
                                      typeState.scores[participant.id] === val
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border hover:border-primary hover:bg-primary/5'
                                    )}
                                  >
                                    {val}
                                  </button>
                                ))}
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
          disabled={completedCount < relationshipTypes.length || submitting}
          className="w-full"
          size="lg"
        >
          {submitting ? 'Submitting...' : 'Submit nominations'}
        </Button>
      </div>
    </div>
  )
}
