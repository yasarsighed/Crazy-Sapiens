'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BUILT_IN_SCALES, type BuiltInScale } from '@/lib/scales'
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
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Brain, ArrowLeft, Clock, AlertTriangle } from 'lucide-react'

interface AddQuestionnaireDialogProps {
  studyId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type Step = 'pick-scale' | 'configure'

export function AddQuestionnaireDialog({
  studyId,
  open,
  onClose,
  onSuccess,
}: AddQuestionnaireDialogProps) {
  const [step, setStep] = useState<Step>('pick-scale')
  const [selectedScale, setSelectedScale] = useState<BuiltInScale | null>(null)
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [alertThreshold, setAlertThreshold] = useState('')
  const [saving, setSaving] = useState(false)

  const handleScaleSelect = (scale: BuiltInScale) => {
    setSelectedScale(scale)
    setTitle(scale.full_name)
    // Default instructions vary by scale type
    const defaultInstructions =
      scale.abbreviation === 'AAQ-II'
        ? 'Below you will find a list of statements. Please rate how true each statement is for you.'
        : scale.abbreviation === 'MPFI'
        ? 'Using the scale below, please indicate how true each of the following statements was for you over the past two weeks.'
        : 'Over the last 2 weeks, how often have you been bothered by any of the following problems?'
    setInstructions(defaultInstructions)
    setAlertEnabled(scale.requires_clinical_alert)
    setAlertThreshold(String(scale.clinical_alert_threshold))
    setStep('configure')
  }

  const handleSave = async () => {
    if (!selectedScale || !title.trim()) return
    setSaving(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Not authenticated')
      setSaving(false)
      return
    }

    try {
      // 1. Create questionnaire_instruments record
      const { data: questionnaire, error: qError } = await supabase
        .from('questionnaire_instruments')
        .insert({
          study_id: studyId,
          created_by: user.id,
          title: title.trim(),
          instructions: instructions.trim() || null,
          status: 'active',
          is_validated_scale: true,
          validated_scale_name: selectedScale.abbreviation,
          validated_scale_citation: selectedScale.citation,
          auto_score: true,
          show_score_to_participant: false,
          show_feedback_to_participant: false,
          clinical_alert_enabled: alertEnabled,
          clinical_alert_threshold: alertEnabled
            ? parseFloat(alertThreshold) || selectedScale.clinical_alert_threshold
            : null,
          clinical_alert_logic: selectedScale.clinical_alert_logic,
          estimated_duration_minutes: selectedScale.estimated_duration_minutes,
        })
        .select('id')
        .single()

      if (qError || !questionnaire) {
        throw new Error(qError?.message ?? 'Failed to create questionnaire')
      }

      // 2. Create study_instruments record (links questionnaire to the study list)
      const { data: studyInstrument, error: siError } = await supabase
        .from('study_instruments')
        .insert({
          study_id: studyId,
          instrument_type: 'questionnaire',
          instrument_label: title.trim(),
          instrument_id: questionnaire.id,
          is_active: true,
          is_mandatory: true,
          order_index: 0,
        })
        .select('id')
        .single()

      if (!siError && studyInstrument) {
        // Update questionnaire with back-reference to study_instruments
        await supabase
          .from('questionnaire_instruments')
          .update({ study_instrument_id: studyInstrument.id })
          .eq('id', questionnaire.id)
      }

      // 3. Seed questionnaire_items from scale definition
      const maxItemScore = Math.max(
        ...selectedScale.response_options.map(o => o.value)
      )

      const itemInserts = selectedScale.items.map(item => ({
        questionnaire_id: questionnaire.id,
        item_text: item.text,
        item_code: item.code,
        display_order: item.display_order,
        is_active: true,
        response_type: 'likert',
        response_options: selectedScale.response_options,
        response_min: 0,
        response_max: maxItemScore,
        is_required: true,
        is_reverse_scored: item.is_reverse_scored,
        scoring_weight: 1,
        is_clinical_flag_item: item.is_clinical_flag_item,
        clinical_flag_threshold: item.clinical_flag_threshold ?? null,
        clinical_flag_operator: item.clinical_flag_operator ?? null,
        clinical_flag_message: item.clinical_flag_message ?? null,
        helper_text: item.helper_text ?? null,
      }))

      const { error: itemsError } = await supabase
        .from('questionnaire_items')
        .insert(itemInserts)

      if (itemsError) {
        throw new Error(itemsError.message)
      }

      toast.success(`${selectedScale.abbreviation} added to study`, {
        description: `${selectedScale.total_items} items loaded. Participants can now complete it.`,
      })

      onSuccess()
      handleClose()
    } catch (err) {
      toast.error('Failed to create questionnaire', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setStep('pick-scale')
    setSelectedScale(null)
    setTitle('')
    setInstructions('')
    setAlertEnabled(true)
    setAlertThreshold('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">
            {step === 'pick-scale'
              ? 'Add questionnaire'
              : `Configure ${selectedScale?.abbreviation}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1 — Pick scale */}
        {step === 'pick-scale' && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Pick a validated scale. Items and scoring bands are pre-loaded.
            </p>

            {BUILT_IN_SCALES.map(scale => (
              <button
                key={scale.abbreviation}
                onClick={() => handleScaleSelect(scale)}
                className="w-full text-left border border-border rounded-xl p-4 hover:border-primary hover:bg-primary/5 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-serif font-semibold text-base">
                        {scale.abbreviation}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {scale.domain}
                      </Badge>
                      {scale.requires_clinical_alert && (
                        <Badge className="text-[10px] bg-destructive/10 text-destructive border border-destructive/20">
                          Clinical alerts
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{scale.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {scale.total_items} items · ~{scale.estimated_duration_minutes} min
                    </p>
                  </div>
                  <Brain className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-1 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Configure */}
        {step === 'configure' && selectedScale && (
          <div className="space-y-4 pt-2">
            <button
              onClick={() => setStep('pick-scale')}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Change scale
            </button>

            <div className="space-y-2">
              <Label htmlFor="q-title">Title shown to participants</Label>
              <Input
                id="q-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={selectedScale.full_name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="q-instructions">Instructions</Label>
              <Textarea
                id="q-instructions"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={3}
                placeholder="Over the last 2 weeks, how often have you been bothered by..."
              />
            </div>

            {/* Clinical alerts toggle */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Clinical alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Fire an alert when total score ≥ threshold
                  </p>
                </div>
                <Switch
                  checked={alertEnabled}
                  onCheckedChange={val => setAlertEnabled(val)}
                />
              </div>

              {alertEnabled && (
                <div className="space-y-1">
                  <Label htmlFor="alert-threshold" className="text-xs">
                    Alert threshold (total score)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="alert-threshold"
                      type="number"
                      value={alertThreshold}
                      onChange={e => setAlertThreshold(e.target.value)}
                      className="w-24"
                      min={0}
                      max={selectedScale.scale_max}
                    />
                    <p className="text-xs text-muted-foreground">
                      / {selectedScale.scale_max} (default: {selectedScale.clinical_alert_threshold})
                    </p>
                  </div>
                </div>
              )}

              {selectedScale.items.some(i => i.is_clinical_flag_item) && (
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Item-level alerts are always on for{' '}
                    {selectedScale.abbreviation} (e.g. suicidal ideation item).
                  </span>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">{selectedScale.total_items} items</span> will be loaded.
                Severity bands: {selectedScale.severity_bands.map(b => b.label).join(' → ')}.
              </p>
              {selectedScale.scoring_note && (
                <p className="text-muted-foreground/70 italic">{selectedScale.scoring_note}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="flex-1"
              >
                {saving ? 'Creating...' : 'Create questionnaire'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
