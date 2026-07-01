import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ThemeToggleButton } from '@/components/theme-toggle-button'
import { ArrowLeft, User, Sparkles } from 'lucide-react'

export default async function ParticipantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const isResearcher = profile?.role === 'researcher' || profile?.role === 'admin'

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{
        // Warm, brand-tinted paper surface — adapts to dark mode via tokens.
        background:
          'radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, var(--brand-orange) 8%, var(--background)) 0%, var(--background) 60%)',
      }}
    >

      {/* Researcher preview banner */}
      {isResearcher && (
        <div className="bg-accent px-4 py-2 flex items-center justify-between gap-4">
          <p className="text-xs text-accent-foreground font-medium">
            👁️ <strong>Researcher preview</strong> — you are seeing the participant portal as <strong>{profile?.full_name ?? user.email}</strong>
          </p>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs font-bold text-accent-foreground hover:opacity-80 whitespace-nowrap transition-opacity"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to dashboard
          </Link>
        </div>
      )}

      {/* Sticky header */}
      <header className="border-b border-border/70 bg-card/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-1.5">
            <ThemeToggleButton />
            <Link
              href="/participant/profile"
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 transition-opacity bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full"
            >
              <User className="w-3.5 h-3.5" />
              My Profile
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-16">{children}</main>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border/70 bg-card/80 backdrop-blur-md py-2">
        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3 text-accent" />
          Your responses support meaningful research. Thank you for contributing.
        </p>
      </div>
    </div>
  )
}
