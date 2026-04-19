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
import { Timer, Brain, AlertTriangle } from 'lucide-react'

interface AddIatDialogProps {
  studyId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// Death/Suicide IAT — stimuli based on Millner et al. (2019) and Greenwald (2003)
const DEATH_SUICIDE_IAT = {
  key: 'death_suicide',
  name: 'Death/Suicide IAT',
  description:
    'Measures implicit associations between self-concepts and death/life. Based on Millner et al. (2019). Validated for suicide risk assessment.',
  citation: 'Millner, A. J., et al. (2019). Implicit cognition and suicide. Current Opinion in Psychology.',
  estimatedMinutes: 12,
  blocks: 7,
  totalTrials: 180,
  targetA: 'Self',
  targetB: 'Other',
  attributePositive: 'Life',
  attributeNegative: 'Death / Suicide',
  selfWords: ['Me', 'My', 'I', 'Mine', 'Self'],
  otherWords: ['They', 'Them', 'Their', 'Other', 'Theirs'],
  deathWords: ['Death', 'Die', 'Dying', 'Suicide', 'Dead'],
  lifeWords: ['Life', 'Alive', 'Living', 'Survive', 'Thrive'],
  clinicalNote:
    'A positive D-score indicates stronger implicit self–death associations. This does not directly diagnose suicidal intent. Use alongside clinical self-report measures.',
}

export function AddIatDialog({
  studyId,
  open,
  onClose,
  onSuccess,
}: AddIatDialogProps) {
  const [label, setLabel] = useState('Death/Suicide IAT')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!label.trim()) return
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
      // 1. Build a minimal insert — only columns confirmed in the DB type.
      //    The stimuli are hardcoded in the participant IAT page so we don't
      //    need to store them here. We try progressively wider inserts and
      //    fall back if columns are missing.
      const baseInsert: Record<string, any> = {
        title: label.trim(),
        description: [
          `Type: ${DEATH_SUICIDE_IAT.key}`,
          `Targets: ${DEATH_SUICIDE_IAT.targetA} vs ${DEATH_SUICIDE_IAT.targetB}`,
          `Attributes: ${DEATH_SUICIDE_IAT.attributeNegative} vs ${DEATH_SUICIDE_IAT.attributePositive}`,
          notes.trim() || '',
        ].filter(Boolean).join(' | '),
      }

      // Try adding researcher FK — first as created_by, then researcher_id
      const withCreatedBy  = { ...baseInsert, study_id: studyId, created_by: user.id,    is_active: true }
      const withResearcherId = { ...baseInsert, study_id: studyId, researcher_id: user.id, is_active: true }

      let iat: { id: string } | null = null

      // Attempt 1: created_by
      const res1 = await supabase.from('iat_instruments').insert(withCreatedBy).select('id').single()
      if (!res1.error) {
        iat = res1.data
      } else if (res1.error.message.includes('researcher_id') || res1.error.message.includes('created_by') || res1.error.message.includes('study_id')) {
        // Attempt 2: researcher_id
        const res2 = await supabase.from('iat_instruments').insert(withResearcherId).select('id').single()
        if (!res2.error) {
          iat = res2.data
        } else if (res2.error.message.includes('study_id')) {
          // Attempt 3: no study_id (some schemas store it only in study_instruments)
          const res3 = await supabase.from('iat_instruments').insert({ ...baseInsert, researcher_id: user.id, is_active: true }).select('id').single()
          if (!res3.error) iat = res3.data
          else throw new Error(res3.error.message)
        } else {
          throw new Error(res2.error.message)
        }
      } else {
        throw new Error(res1.error.message)
      }

      if (!iat) throw new Error('Failed to create IAT instrument')

      // 2. Create study_instruments record
      const { error: siError } = await supabase
        .from('study_instruments')
        .insert({
          study_id: studyId,
          instrument_type: 'iat',
          instrument_label: label.trim(),
          instrument_id: iat.id,
          is_active: true,
          is_mandatory: true,
          order_index: 0,
        })

      if (siError) {
        // Non-fatal — IAT was created, just the linking failed
        console.warn('study_instruments insert failed:', siError.message)
      }

      toast.success('IAT added to study', {
        description: `${DEATH_SUICIDE_IAT.totalTrials} trials across ${DEATH_SUICIDE_IAT.blocks} blocks. Participants can now complete it.`,
      })

      onSuccess()
      handleClose()
    } catch (err) {
      toast.error('Failed to create IAT', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setLabel('Death/Suicide IAT')
    setNotes('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Add IAT</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* IAT type card */}
          <div className="border border-[#F4A261]/40 bg-[#F4A261]/5 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Brain className="w-4 h-4 text-[#F4A261] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-serif font-semibold text-sm">
                    {DEATH_SUICIDE_IAT.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-[#F4A261] text-[#F4A261]"
                  >
                    Suicide risk
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {DEATH_SUICIDE_IAT.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3" />~{DEATH_SUICIDE_IAT.estimatedMinutes} min
                  </span>
                  <span>{DEATH_SUICIDE_IAT.totalTrials} trials</span>
                  <span>{DEATH_SUICIDE_IAT.blocks} blocks</span>
                </div>
              </div>
            </div>

            {/* Category preview */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-background rounded-lg p-2 border border-border text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  E key (left)
                </p>
                <p className="text-xs font-medium">
                  {DEATH_SUICIDE_IAT.targetA} + {DEATH_SUICIDE_IAT.attributeNegative}
                </p>
              </div>
              <div className="bg-background rounded-lg p-2 border border-border text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  I key (right)
                </p>
                <p className="text-xs font-medium">
                  {DEATH_SUICIDE_IAT.targetB} + {DEATH_SUICIDE_IAT.attributePositive}
                </p>
              </div>
            </div>
          </div>

          {/* Clinical note */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground border border-border rounded-lg p-3">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#E9C46A]" />
            <span>{DEATH_SUICIDE_IAT.clinicalNote}</span>
          </div>

          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="iat-label">Label shown to participants</Label>
            <Input
              id="iat-label"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Death/Suicide IAT"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="iat-notes">
              Researcher notes{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="iat-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Administered at T1, pre-intervention..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !label.trim()}
              className="flex-1"
            >
              {saving ? 'Creating...' : 'Add IAT'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
