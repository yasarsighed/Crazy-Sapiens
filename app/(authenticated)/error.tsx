'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Next.js's error-boundary convention: catches a render/runtime error
// anywhere under app/(authenticated)/ and shows this instead of taking
// the whole app down. The sidebar (from the still-mounted layout) stays
// up, so navigation away from the broken page always works.
export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[authenticated] Unhandled error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
        <AlertTriangle className="w-7 h-7 text-destructive" />
      </div>
      <h1 className="font-serif text-xl text-foreground mb-2">Something broke on this page.</h1>
      <p className="text-sm text-muted-foreground max-w-sm mb-1">
        The rest of the app is fine — just this one didn't survive. Reviewer 2 has been notified.
      </p>
      {error.digest && (
        <p className="text-[11px] font-mono text-muted-foreground/60 mb-6">Error ref: {error.digest}</p>
      )}
      <div className="flex items-center gap-3 mt-5">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
