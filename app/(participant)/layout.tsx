import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/logo'

export default async function ParticipantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header — no sidebar, no researcher tools */}
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground">Participant portal</p>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
