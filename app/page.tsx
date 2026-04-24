import Link from 'next/link'
import { Mascot } from '@/components/mascot'
import { Button } from '@/components/ui/button'

export default function SplashPage() {
  return (
    <main className="min-h-screen bg-background dot-grid flex flex-col items-center justify-center p-8 relative">
      {/* Main content */}
      <div className="flex flex-col items-center text-center max-w-xl">
        {/* Mascot */}
        <div className="mb-6">
          <Mascot size="xl" />
        </div>
        
        {/* Wordmark */}
        <div className="flex flex-col items-center leading-none mb-3">
          <span className="font-[family-name:var(--font-permanent-marker)] text-4xl text-[#1A2E1A] -rotate-2">
            CRAZY
          </span>
          <span className="font-[family-name:var(--font-caveat)] font-bold text-5xl text-primary -mt-1">
            Sapiens
          </span>
        </div>
        
        {/* Tagline */}
        <p className="text-[13px] text-muted-foreground font-sans mb-8">
          Serious science. Questionable sanity. Zero excuses.
        </p>
        
        {/* Horizontal rule with ampersand */}
        <div className="flex items-center gap-4 w-full max-w-xs mb-8">
          <div className="flex-1 h-px bg-border" />
          <span className="text-muted-foreground text-sm font-serif">&amp;</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        
        {/* Founder dedication */}
        <div className="mb-10 text-center">
          <p className="text-[15px] text-muted-foreground italic font-sans mb-3">
            Brought into existence — against all odds and several deadlines — by
          </p>
          <p className="font-serif text-lg text-foreground">
            Pradipta Poddar, Nandani Sharma &amp; Yasar Syed
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-2 font-sans">
            (No participants were harmed. Probably.)
          </p>
        </div>
        
        {/* Enter button */}
        <Button asChild size="lg" className="px-8">
          <Link href="/login">
            Enter the lab
          </Link>
        </Button>
      </div>
      
      {/* Bottom left version */}
      <div className="absolute bottom-6 left-6">
        <span className="text-[11px] text-muted-foreground/60">v1.0</span>
      </div>
      
      {/* Bottom right copyright */}
      <div className="absolute bottom-6 right-6">
        <span className="text-[11px] text-muted-foreground/60">
          &copy; 2026 Crazy Sapiens &mdash; Syed, Sharma &amp; Poddar
        </span>
      </div>
    </main>
  )
}
