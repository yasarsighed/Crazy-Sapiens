'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

interface LeaveStudyButtonProps {
  studyId: string
  studyTitle: string
}

export function LeaveStudyButton({ studyId, studyTitle }: LeaveStudyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'confirming' | 'loading'>('idle')
  const router = useRouter()

  const handleLeave = async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        alert('Could not withdraw: ' + (err.error ?? 'Unknown error'))
        setStatus('idle')
      }
    } catch {
      alert('Network error. Please try again.')
      setStatus('idle')
    }
  }

  if (status === 'confirming') {
    return (
      <div className="border border-destructive/30 rounded-xl p-4 mt-4 space-y-3">
        <p className="text-sm font-medium text-destructive">Withdraw from &ldquo;{studyTitle}&rdquo;?</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This will permanently delete all your responses for this study — questionnaires,
          IAT data, and sociogram nominations. This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleLeave}
            className="flex-1 text-xs font-medium text-white bg-destructive rounded-lg px-3 py-2 hover:bg-destructive/90 transition-colors"
          >
            Yes, withdraw and delete my data
          </button>
          <button
            onClick={() => setStatus('idle')}
            className="flex-1 text-xs text-muted-foreground border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setStatus('confirming')}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors mt-3"
    >
      <LogOut className="w-3 h-3" />
      Withdraw from this study
    </button>
  )
}
