import Link from 'next/link'
import { Mascot } from '@/components/mascot'
import { Button } from '@/components/ui/button'

// A handful of dry, researcher-flavoured 404 lines — never shown anywhere
// near clinical data or the participant side, just here where a mistyped
// URL landed someone.
const NOT_FOUND_LINES = [
  "This page didn't replicate.",
  'p > .05 — we fail to reject the null: this page does not exist.',
  "Even a null result is still a result. This isn't even that.",
  'Reviewer 2 requested this page be removed.',
]

function pickLine(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return NOT_FOUND_LINES[dayOfYear % NOT_FOUND_LINES.length]
}

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background dot-grid flex flex-col items-center justify-center p-8 relative">
      <div className="flex flex-col items-center text-center max-w-xl">
        <div className="mb-6">
          <Mascot size="xl" />
        </div>

        <p className="text-[13px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--brand-gold)' }}>
          404
        </p>

        <p className="font-serif text-2xl text-foreground mb-3">
          {pickLine()}
        </p>

        <p className="text-sm text-muted-foreground font-sans mb-2 max-w-sm">
          The page you're looking for wandered off the sampling frame.
        </p>

        <p className="text-xs text-muted-foreground/70 italic font-sans mb-8">
          It's okay, even Rashmin sir makes mistakes.
        </p>

        <Button asChild size="lg" className="px-8">
          <Link href="/dashboard">Back to the lab</Link>
        </Button>
      </div>
    </main>
  )
}
