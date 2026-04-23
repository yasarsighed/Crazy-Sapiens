'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Timer, Brain, AlertTriangle, CheckCircle2, BookOpen, SkipForward } from 'lucide-react'
import { IAT_TYPES, IAT_TYPE_COLUMN_MISSING_RE, type IATTypeConfig } from '@/lib/iat-types'
import { getScaleByAbbreviation } from '@/lib/scales'
import { cn } from '@/lib/utils'

interface AddIatDialogProps {
  studyId: string
  open:    boolean
  onClose: () => void
  onSuccess: () => void
}

type Phase = 'config' | 'companion'

export function AddIatDialog({ studyId, open, onClose, onSuccess }: AddIatDialogProps) {
  const [phase,    setPhase]    = useState<Phase>('config')
  const [selected, setSelected] = useState<IATTypeConfig>(IAT_TYPES[0])
  const [label,    setLabel]    = useState('')
  const [notes,    setNotes]    = useState('')
  const [debrief,  setDebrief]  = useState('')
  const [saving,   setSaving]   = useState(false)

  const companionScale = getScaleByAbbreviation(selected.companionScaleAbbreviation)

  const handleSave = async () => {
    const title = label.trim() || selected.name
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Not authenticated'); setSaving(false); return }

    try {
      const debriefText = debrief.trim()
      const basePayload = {
        study_id:          studyId,
        title,
        description:       notes.trim() || `${selected.name}. ${selected.citation}`,
        concept_a_label:   selected.conceptALabel,
        concept_b_label:   selected.conceptBLabel,
        attribute_a_label: selected.attrALabel,
        attribute_b_label: selected.attrBLabel,
        ...(debriefText ? { debrief_text: debriefText } : {}),
      }

      let result = await supabase
        .from('iat_instruments')
        .insert({ ...basePayload, iat_type: selected.key })
        .select('id')
        .single()

      // Schema migration guard: iat_type column not yet added to this deployment.
      // Retry without it so the IAT is still created; warn researcher to run migration.
      if (result.error && IAT_TYPE_COLUMN_MISSING_RE.test(result.error.message)) {
        toast.warning('iat_type column missing — run the migration SQL in Supabase', {
          description: "ALTER TABLE iat_instruments ADD COLUMN IF NOT EXISTS iat_type TEXT NOT NULL DEFAULT 'death_suicide';",
          duration: 12000,
        })
        result = await supabase
          .from('iat_instruments')
          .insert(basePayload)
          .select('id')
          .single()
      }

      const { data: iat, error: iatErr } = result
      if (iatErr || !iat) throw new Error(iatErr?.message ?? 'Insert failed')

      // study_instruments is a denormalised index; failure is non-fatal because
      // the study page queries instrument tables directly as a fallback.
      await Promise.resolve(supabase.from('study_instruments').insert({
        study_id:         studyId,
        instrument_type:  'iat',
        instrument_label: title,
        instrument_id:    iat.id,
        is_active:        true,
        is_mandatory:     true,
        order_index:      0,
      })).catch((e) => console.warn('study_instruments link failed (non-fatal):', e))

      toast.success('IAT added to study', {
        description: `180 trials · 7 blocks · ~${selected.estimatedMinutes} min`,
      })
      onSuccess()
      setPhase('companion')
    } catch (err) {
      toast.error('Failed to create IAT', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddCompanion = async () => {
    if (!companionScale) { handleClose(); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Not authenticated'); setSaving(false); return }

    try {
      const { data: questionnaire, error: qErr } = await supabase
        .from('questionnaire_instruments')
        .insert({
          study_id:                    studyId,
          created_by:                  user.id,
          title:                       companionScale.full_name,
          instructions:                'Please indicate how much you agree or disagree with each statement.',
          status:                      'active',
          is_validated_scale:          true,
          validated_scale_name:        companionScale.abbreviation,
          validated_scale_citation:    companionScale.citation,
          auto_score:                  true,
          show_score_to_participant:   false,
          show_feedback_to_participant: false,
          clinical_alert_enabled:      companionScale.requires_clinical_alert,
          clinical_alert_threshold:    companionScale.requires_clinical_alert
                                         ? companionScale.clinical_alert_threshold
                                         : null,
          clinical_alert_logic:        companionScale.clinical_alert_logic,
          estimated_duration_minutes:  companionScale.estimated_duration_minutes,
        })
        .select('id')
        .single()

      if (qErr || !questionnaire) throw new Error(qErr?.message ?? 'Failed to create questionnaire')

      const maxItemScore = Math.max(...companionScale.response_options.map(o => o.value))
      const itemInserts = companionScale.items.map(item => ({
        questionnaire_id:        questionnaire.id,
        item_text:               item.text,
        item_code:               item.code,
        display_order:           item.display_order,
        is_active:               true,
        response_type:           'likert',
        response_options:        companionScale.response_options,
        response_min:            0,
        response_max:            maxItemScore,
        is_required:             true,
        is_reverse_scored:       item.is_reverse_scored,
        scoring_weight:          1,
        is_clinical_flag_item:   item.is_clinical_flag_item,
        clinical_flag_threshold: item.clinical_flag_threshold ?? null,
        clinical_flag_operator:  item.clinical_flag_operator ?? null,
        clinical_flag_message:   item.clinical_flag_message ?? null,
        helper_text:             item.helper_text ?? null,
      }))

      // study_instruments and questionnaire_items have no dependency on each other
      const [{ data: si }, { error: itemsErr }] = await Promise.all([
        supabase
          .from('study_instruments')
          .insert({
            study_id:         studyId,
            instrument_type:  'questionnaire',
            instrument_label: companionScale.full_name,
            instrument_id:    questionnaire.id,
            is_active:        true,
            is_mandatory:     true,
            order_index:      0,
          })
          .select('id')
          .single(),
        supabase.from('questionnaire_items').insert(itemInserts),
      ])

      if (itemsErr) throw new Error(itemsErr.message)

      if (si) {
        await supabase
          .from('questionnaire_instruments')
          .update({ study_instrument_id: si.id })
          .eq('id', questionnaire.id)
      }

      toast.success(`${companionScale.abbreviation} added`, {
        description: `${companionScale.total_items} items · participants will see both instruments.`,
      })
      onSuccess()
      handleClose()
    } catch (err) {
      toast.error('Failed to add companion questionnaire', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setPhase('config')
    setSelected(IAT_TYPES[0])
    setLabel('')
    setNotes('')
    setDebrief('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">
            {phase === 'config' ? 'Add IAT instrument' : 'Add companion questionnaire?'}
          </DialogTitle>
        </DialogHeader>

        {/* ── Phase 1: IAT configuration ──────────────────────────────────────── */}
        {phase === 'config' && (
          <div className="space-y-5 pt-2">

            {/* Type picker */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Select IAT type
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {IAT_TYPES.map(type => {
                  const isSelected = selected.key === type.key
                  return (
                    <button
                      key={type.key}
                      onClick={() => { setSelected(type); setLabel('') }}
                      className={cn(
                        'relative text-left rounded-xl border p-3 transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30',
                      )}
                    >
                      {isSelected && (
                        <CheckCircle2 className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-primary" />
                      )}
                      <div className="flex items-center gap-2 mb-1 pr-5">
                        <span className="text-sm font-medium">{type.name}</span>
                      </div>
                      <Badge
                        className="text-[9px] mb-1.5 font-normal"
                        style={{ backgroundColor: type.badgeColor + '22', color: type.badgeColor, borderColor: type.badgeColor + '44' }}
                        variant="outline"
                      >
                        {type.badge}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                        {type.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/70">
                        <Timer className="w-3 h-3" />
                        ~{type.estimatedMinutes} min · 180 trials · 7 blocks
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected type detail */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">{selected.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border bg-background p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">E key (left)</p>
                  <p className="font-medium">{selected.conceptALabel} + {selected.attrALabel}</p>
                  <p className="text-muted-foreground mt-1 leading-snug">
                    {[...selected.wordsConceptA.slice(0,3), ...selected.wordsAttrA.slice(0,2)].join(' · ')}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">I key (right)</p>
                  <p className="font-medium">{selected.conceptBLabel} + {selected.attrBLabel}</p>
                  <p className="text-muted-foreground mt-1 leading-snug">
                    {[...selected.wordsConceptB.slice(0,3), ...selected.wordsAttrB.slice(0,2)].join(' · ')}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic leading-snug">
                {selected.positiveD}
              </p>
            </div>

            {/* Clinical note */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground border border-border rounded-lg p-3">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>{selected.clinicalNote}</span>
            </div>

            {/* Label */}
            <div className="space-y-1.5">
              <Label htmlFor="iat-label">
                Label shown to participants{' '}
                <span className="text-muted-foreground font-normal">(leave blank to use type name)</span>
              </Label>
              <Input
                id="iat-label"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={selected.name}
              />
            </div>

            {/* Researcher notes */}
            <div className="space-y-1.5">
              <Label htmlFor="iat-notes">
                Researcher notes{' '}
                <span className="text-muted-foreground font-normal">(optional, not shown to participants)</span>
              </Label>
              <Textarea
                id="iat-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Administered at T1, pre-intervention…"
              />
            </div>

            {/* Custom debrief */}
            <div className="space-y-1.5">
              <Label htmlFor="iat-debrief">
                Custom participant debrief{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="iat-debrief"
                value={debrief}
                onChange={e => setDebrief(e.target.value)}
                rows={3}
                placeholder={`Shown to participants after the test instead of the default debrief. Default: "${selected.defaultDebriefNote.slice(0, 80)}…"`}
              />
              <p className="text-[11px] text-muted-foreground">
                If left blank, a scientifically grounded debrief specific to this IAT type is shown automatically.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? 'Creating…' : 'Add IAT'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Phase 2: Companion questionnaire offer ──────────────────────────── */}
        {phase === 'companion' && companionScale && (
          <div className="space-y-5 pt-2">
            <p className="text-sm text-muted-foreground">
              Project Implicit and other IAT researchers pair each implicit measure with a
              matched explicit-attitude scale. This lets you compute implicit–explicit
              correlations, split participants into aware and unaware groups, and report
              both measures together — the standard in published IAT research.
            </p>

            {/* Companion scale card */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-serif font-semibold">{companionScale.abbreviation}</span>
                    <Badge variant="outline" className="text-[10px]">{companionScale.domain}</Badge>
                  </div>
                  <p className="text-sm font-medium">{companionScale.full_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{companionScale.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      ~{companionScale.estimated_duration_minutes} min
                    </span>
                    <span>{companionScale.total_items} items</span>
                    <span>Severity: {companionScale.severity_bands.map(b => b.label).join(' → ')}</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground italic border-t border-border/50 pt-2">
                Items and scoring bands are pre-loaded. No manual setup needed.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 gap-2"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip
              </Button>
              <Button
                onClick={handleAddCompanion}
                disabled={saving}
                className="flex-1 gap-2"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {saving ? 'Adding…' : `Add ${companionScale.abbreviation} questionnaire`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
