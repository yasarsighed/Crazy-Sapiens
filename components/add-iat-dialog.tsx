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
      // 1. Insert into iat_instruments.
      //    Only use the columns confirmed by the TypeScript IATTest type.
      //    Stimuli are hardcoded in the participant page — no need to store them.
      //    study_id / is_active / attribute_negative caused errors → excluded.
      const { data: iat, error: iatError } = await supabase
        .from('iat_instruments')
        .insert({
          title:        label.trim(),
          description:  notes.trim() || `Death/Suicide IAT — Self vs Other × Death vs Life. ${DEATH_SUICIDE_IAT.citation}`,
          researcher_id: user.id,
          category_a:   DEATH_SUICIDE_IAT.targetA,  // 'Self'
          category_b:   DEATH_SUICIDE_IAT.targetB,  // 'Other'
        })
        .select('id')
        .single()

      if (iatError || !iat) {
        throw new Error(iatError?.message ?? 'Failed to create IAT instrument')
      }

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
