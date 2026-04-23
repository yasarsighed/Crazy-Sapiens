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
import { Timer, Brain, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { IAT_TYPES, type IATTypeConfig } from '@/lib/iat-types'
import { cn } from '@/lib/utils'

interface AddIatDialogProps {
  studyId: string
  open:    boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddIatDialog({ studyId, open, onClose, onSuccess }: AddIatDialogProps) {
  const [selected, setSelected]   = useState<IATTypeConfig>(IAT_TYPES[0])
  const [label,    setLabel]      = useState('')
  const [notes,    setNotes]      = useState('')
  const [debrief,  setDebrief]    = useState('')
  const [saving,   setSaving]     = useState(false)

  const handleSave = async () => {
    const title = label.trim() || selected.name
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Not authenticated'); setSaving(false); return }

    try {
      const { data: iat, error: iatErr } = await supabase
        .from('iat_instruments')
        .insert({
          study_id:          studyId,
          title,
          description:       notes.trim() || `${selected.name}. ${selected.citation}`,
          concept_a_label:   selected.conceptALabel,
          concept_b_label:   selected.conceptBLabel,
          attribute_a_label: selected.attrALabel,
          attribute_b_label: selected.attrBLabel,
          iat_type:          selected.key,
          ...(debrief.trim() ? { debrief_text: debrief.trim() } : {}),
        })
        .select('id')
        .single()

      if (iatErr || !iat) throw new Error(iatErr?.message ?? 'Insert failed')

      await Promise.resolve(supabase.from('study_instruments').insert({
        study_id: studyId,
        instrument_type:  'iat',
        instrument_label: title,
        instrument_id:    iat.id,
        is_active:  true,
        is_mandatory: true,
        order_index: 0,
      })).catch(() => {}) // non-fatal

      toast.success('IAT added to study', {
        description: `180 trials · 7 blocks · ~${selected.estimatedMinutes} min`,
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
          <DialogTitle className="font-serif text-lg">Add IAT instrument</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">

          {/* ── Type picker ──────────────────────────────────────────────── */}
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

          {/* ── Selected type detail ─────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">{selected.name}</span>
            </div>

            {/* Category preview */}
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

          {/* Clinical / methodological note */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground border border-border rounded-lg p-3">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
            <span>{selected.clinicalNote}</span>
          </div>

          {/* ── Label ───────────────────────────────────────────────────── */}
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

          {/* ── Researcher notes ─────────────────────────────────────────── */}
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

          {/* ── Debrief ──────────────────────────────────────────────────── */}
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
      </DialogContent>
    </Dialog>
  )
}
