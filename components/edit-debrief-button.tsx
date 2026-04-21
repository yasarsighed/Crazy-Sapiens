'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  iatId: string
  initialText: string | null
}

export function EditDebriefButton({ iatId, initialText }: Props) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(initialText ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('iat_instruments')
      .update({ debrief_text: text.trim() || null })
      .eq('id', iatId)
    if (error) {
      toast.error('Failed to save debrief text', { description: error.message })
    } else {
      toast.success('Debrief text saved')
      setEditing(false)
    }
    setSaving(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded px-2.5 py-1 hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <Pencil className="w-3 h-3" />
        {initialText ? 'Edit debrief text' : 'Add debrief text'}
      </button>
    )
  }

  return (
    <div className="space-y-2 mt-2">
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={5}
        placeholder="Shown to participants after completing the IAT. Explain what the measure captures, provide reassurance, and clarify that implicit associations do not determine behaviour…"
        className="text-sm"
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Check className="w-3.5 h-3.5 mr-1.5" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setText(initialText ?? ''); setEditing(false) }}
          disabled={saving}
        >
          <X className="w-3.5 h-3.5 mr-1.5" />
          Cancel
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Leave blank to use the standard evidence-based debrief.
      </p>
    </div>
  )
}
