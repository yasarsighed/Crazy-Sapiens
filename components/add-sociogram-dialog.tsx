'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'

const DEFAULT_RELATIONSHIP_TYPES = [
  {
    label: 'Communication',
    description: 'Who do you communicate with regularly?',
    color_hex: '#457B9D',
    is_negative_dimension: false,
    display_order: 1,
  },
  {
    label: 'Advice',
    description: 'Who do you go to for professional advice?',
    color_hex: '#2D6A4F',
    is_negative_dimension: false,
    display_order: 2,
  },
  {
    label: 'Trust',
    description: 'Who do you trust with important information?',
    color_hex: '#9A6B00',
    is_negative_dimension: false,
    display_order: 3,
  },
  {
    label: 'Collaboration',
    description: 'Who do you collaborate with on tasks?',
    color_hex: '#7C3AAF',
    is_negative_dimension: false,
    display_order: 4,
  },
  {
    label: 'Conflict',
    description: 'Who do you experience tension or conflict with?',
    color_hex: '#E63946',
    is_negative_dimension: true,
    display_order: 5,
  },
  {
    label: 'Avoidance',
    description: 'Who do you tend to avoid in professional settings?',
    color_hex: '#6B6B80',
    is_negative_dimension: true,
    display_order: 6,
  },
]

interface Props {
  studyId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddSociogramDialog({ studyId, open, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState('Sociogram')
  const [instructions, setInstructions] = useState(
    'For each relationship type below, nominate the people from your group who apply. Your responses are confidential.'
  )
  const [minNominations, setMinNominations] = useState('1')
  const [maxNominations, setMaxNominations] = useState('5')
  const [allowSelf, setAllowSelf] = useState(false)
  const [scaleEnabled, setScaleEnabled] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    DEFAULT_RELATIONSHIP_TYPES.filter(t => !t.is_negative_dimension).map(t => t.label)
  )
  const [saving, setSaving] = useState(false)

  const toggleType = (label: string) => {
    setSelectedTypes(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  const handleSave = async () => {
    if (!title.trim() || selectedTypes.length === 0) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Not authenticated')
      setSaving(false)
      return
    }

    try {
      // 1. Create sociogram_instruments
      const { data: sociogram, error: sError } = await supabase
        .from('sociogram_instruments')
        .insert({
          study_id: studyId,
          created_by: user.id,
          title: title.trim(),
          instructions: instructions.trim() || null,
          status: 'active',
          anonymise_names: false,
          min_nominations: parseInt(minNominations) || 1,
          max_nominations: parseInt(maxNominations) || 5,
          allow_self_nomination: allowSelf,
          allow_negative_ties: selectedTypes.some(t =>
            DEFAULT_RELATIONSHIP_TYPES.find(d => d.label === t)?.is_negative_dimension
          ),
          relationship_scale_min: scaleEnabled ? 1 : null,
          relationship_scale_max: scaleEnabled ? 5 : null,
          scale_label_low: scaleEnabled ? 'Weak' : null,
          scale_label_high: scaleEnabled ? 'Strong' : null,
          show_category_filter: true,
          show_relationship_filter: true,
        })
        .select('id')
        .single()

      if (sError || !sociogram) throw new Error(sError?.message ?? 'Failed to create sociogram')

      // 2. Create study_instruments record
      const { data: studyInstrument } = await supabase
        .from('study_instruments')
        .insert({
          study_id: studyId,
          instrument_type: 'sociogram',
          instrument_label: title.trim(),
          instrument_id: sociogram.id,
          is_active: true,
          is_mandatory: true,
          order_index: 0,
        })
        .select('id')
        .single()

      if (studyInstrument) {
        await supabase
          .from('sociogram_instruments')
          .update({ study_instrument_id: studyInstrument.id })
          .eq('id', sociogram.id)
      }

      // 3. Create relationship types
      const typesToInsert = DEFAULT_RELATIONSHIP_TYPES.filter(t =>
        selectedTypes.includes(t.label)
      ).map(t => ({
        sociogram_id: sociogram.id,
        label: t.label,
        description: t.description,
        color_hex: t.color_hex,
        is_negative_dimension: t.is_negative_dimension,
        display_order: t.display_order,
        is_active: true,
      }))

      const { error: rtError } = await supabase
        .from('sociogram_relationship_types')
        .insert(typesToInsert)

      if (rtError) throw new Error(rtError.message)

      // 4. Seed sociogram_participants from enrolled participants
      const { data: enrollments } = await supabase
        .from('study_enrollments')
        .select('id, participant_id, profiles!study_enrollments_participant_id_fkey(full_name)')
        .eq('study_id', studyId)
        .eq('status', 'active')

      if (enrollments && enrollments.length > 0) {
        const participantInserts = enrollments.map(e => ({
          sociogram_id: sociogram.id,
          participant_id: e.participant_id,
          enrollment_id: e.id,
          display_name: (e.profiles as { full_name: string | null } | null)?.full_name ?? 'Participant',
          has_submitted: false,
          is_active: true,
        }))

        await supabase.from('sociogram_participants').insert(participantInserts)
      }

      toast.success('Sociogram created', {
        description: `${selectedTypes.length} relationship types ready. Participants can now nominate.`,
      })
      onSuccess()
      handleClose()
    } catch (err) {
      toast.error('Failed to create sociogram', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setTitle('Sociogram')
    setInstructions(
      'For each relationship type below, nominate the people from your group who apply. Your responses are confidential.'
    )
    setMinNominations('1')
    setMaxNominations('5')
    setAllowSelf(false)
    setScaleEnabled(true)
    setSelectedTypes(DEFAULT_RELATIONSHIP_TYPES.filter(t => !t.is_negative_dimension).map(t => t.label))
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Add sociogram</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="soc-title">Title</Label>
            <Input
              id="soc-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="soc-instructions">Instructions for participants</Label>
            <Textarea
              id="soc-instructions"
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              rows={3}
            />
          </div>

          {/* Relationship types */}
          <div className="space-y-2">
            <Label>Relationship types</Label>
            <p className="text-xs text-muted-foreground">
              Select which layers participants will nominate for.
            </p>
            <div className="space-y-2">
              {DEFAULT_RELATIONSHIP_TYPES.map(type => (
                <div
                  key={type.label}
                  className="flex items-center gap-3 p-3 border border-border rounded-lg"
                >
                  <Checkbox
                    id={`type-${type.label}`}
                    checked={selectedTypes.includes(type.label)}
                    onCheckedChange={() => toggleType(type.label)}
                  />
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: type.color_hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={`type-${type.label}`}
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      {type.label}
                      {type.is_negative_dimension && (
                        <span className="text-[10px] text-destructive border border-destructive/20 rounded px-1 py-0.5">
                          negative
                        </span>
                      )}
                    </label>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="border border-border rounded-xl p-4 space-y-4">
            <p className="text-sm font-medium">Settings</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Min nominations per type</Label>
                <Input
                  type="number"
                  value={minNominations}
                  onChange={e => setMinNominations(e.target.value)}
                  min={0}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max nominations per type</Label>
                <Input
                  type="number"
                  value={maxNominations}
                  onChange={e => setMaxNominations(e.target.value)}
                  min={1}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Strength rating (1–5)</p>
                <p className="text-xs text-muted-foreground">
                  Participants rate the strength of each tie
                </p>
              </div>
              <Switch checked={scaleEnabled} onCheckedChange={setScaleEnabled} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Allow self-nomination</p>
                <p className="text-xs text-muted-foreground">
                  Participants can nominate themselves
                </p>
              </div>
              <Switch checked={allowSelf} onCheckedChange={setAllowSelf} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim() || selectedTypes.length === 0}
              className="flex-1"
            >
              {saving ? 'Creating...' : 'Create sociogram'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
