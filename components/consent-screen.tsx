'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'

interface ConsentScreenProps {
  studyId: string
  consentText: string | null
  onConsent: () => void
}

const DEFAULT_CONSENT = `By proceeding, you confirm that:

• You are voluntarily participating in this research study.
• You understand that your responses will be stored securely and used solely for research purposes.
• You may withdraw from the study at any time by visiting your participant dashboard — your data will be deleted upon request.
• Your data will be handled in accordance with applicable data protection laws.
• Participation involves completing one or more instruments (questionnaires, sociograms, or an implicit association test).

If you have any questions before proceeding, please contact your researcher.`

export function ConsentScreen({ studyId, consentText, onConsent }: ConsentScreenProps) {
  const [status, setStatus] = useState<'idle' | 'loading'>('idle')

  const handleConsent = async () => {
    if (status === 'loading') return
    setStatus('loading')
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId }),
      })
      if (res.ok) {
        onConsent()
      } else {
        alert('Could not record your consent. Please try again.')
        setStatus('idle')
      }
    } catch {
      alert('Network error. Please check your connection and try again.')
      setStatus('idle')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-serif text-2xl text-foreground">Informed Consent</h1>
          <p className="text-sm text-muted-foreground">Please read carefully before proceeding</p>
        </div>
      </div>

      <div className="border border-border rounded-xl p-5 mb-6 bg-muted/20">
        <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
          {consentText?.trim() || DEFAULT_CONSENT}
        </div>
      </div>

      <div className="space-y-3">
        <Button
          size="lg"
          className="w-full"
          onClick={handleConsent}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Recording consent…' : 'I understand and consent — proceed'}
        </Button>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          You can withdraw your participation at any time from your dashboard.
          Withdrawal permanently deletes your data from this study.
        </p>
      </div>
    </div>
  )
}
