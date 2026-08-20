'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Catches a render/runtime error anywhere under app/(participant)/. Tone
// stays calm and reassuring here (never dry/witty) — this is the
// participant-facing side, and someone mid-questionnaire hitting a broken
// page shouldn't also get a joke about it.
export default function ParticipantError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[participant] Unhandled error:', error)
  }, [error])

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <div className="rounded-3xl bg-card/80 backdrop-blur-sm border border-border p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-muted-foreground" />
        </div>
        <h1 className="font-serif text-lg text-foreground mb-2">Something went wrong.</h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
          This wasn't your fault — the page hit an unexpected error. Nothing you already
          submitted has been lost. Try again, or come back to your dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/participant/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
