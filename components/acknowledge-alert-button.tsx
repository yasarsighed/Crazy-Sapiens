'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

interface Props {
  participantId: string
  questionnaireId: string
  onDone?: () => void
}

export function AcknowledgeAlertButton({ participantId, questionnaireId }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')

  const handleAck = async () => {
    if (status !== 'idle') return
    setStatus('loading')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, questionnaireId }),
      })
      if (res.ok) {
        setStatus('done')
      } else {
        const err = await res.json().catch(() => ({}))
        alert('Could not acknowledge: ' + (err.error ?? 'unknown error'))
        setStatus('idle')
      }
    } catch {
      alert('Network error — please try again.')
      setStatus('idle')
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

  return (
    <button
      onClick={handleAck}
      disabled={status === 'loading'}
      className="text-xs font-medium text-destructive border border-destructive/30 rounded px-2 py-0.5 hover:bg-destructive/5 transition-colors disabled:opacity-40"
    >
      {status === 'loading' ? 'Acknowledging…' : 'Acknowledge'}
    </button>
  )
}
