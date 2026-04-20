'use client'

import { useState } from 'react'
import { CheckCircle, ChevronDown } from 'lucide-react'

interface Props {
  participantId: string
  questionnaireId: string
}

export function AcknowledgeAlertButton({ participantId, questionnaireId }: Props) {
  const [status, setStatus] = useState<'idle' | 'open' | 'loading' | 'done'>('idle')
  const [notes, setNotes] = useState('')

  const handleAck = async () => {
    if (status === 'loading') return
    setStatus('loading')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, questionnaireId, notes: notes.trim() || null }),
      })
      if (res.ok) {
        setStatus('done')
      } else {
        const err = await res.json().catch(() => ({}))
        alert('Could not acknowledge: ' + (err.error ?? 'unknown error'))
        setStatus('open')
      }
    } catch {
      alert('Network error — please try again.')
      setStatus('open')
    }
  }

  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#52B788] font-medium">
        <CheckCircle className="w-3 h-3" />
        Acknowledged
      </span>
    )
  }

  if (status === 'open') {
    return (
      <div className="mt-2 border border-destructive/20 rounded-lg p-3 space-y-2 min-w-[260px]">
        <p className="text-xs font-medium text-destructive">Acknowledge alert</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Follow-up action taken (optional but recommended)…"
          rows={3}
          className="w-full border border-border rounded-md px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-destructive/40 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={handleAck}
            className="flex-1 text-xs font-medium text-white bg-destructive rounded-md px-3 py-1.5 hover:bg-destructive/90 transition-colors"
          >
            Confirm acknowledge
          </button>
          <button
            onClick={() => setStatus('idle')}
            className="text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // idle
  return (
    <button
      onClick={() => setStatus('open')}
      className="flex items-center gap-1 text-xs font-medium text-destructive border border-destructive/30 rounded px-2 py-0.5 hover:bg-destructive/5 transition-colors"
    >
      Acknowledge
      <ChevronDown className="w-3 h-3" />
    </button>
  )
}
