import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ArrowLeft } from 'lucide-react'

export default async function ParticipantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch role to show context bar for researchers/admins
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const isResearcher = profile?.role === 'researcher' || profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-background">
      {/* Researcher context bar — only shown when a researcher/admin visits the participant portal */}
      {isResearcher && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-4">
          <p className="text-xs text-amber-800">
            <strong>Researcher view:</strong> You are previewing the participant portal as{' '}
            <strong>{profile?.full_name ?? user.email}</strong>.
          </p>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-700 whitespace-nowrap"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to researcher dashboard
          </Link>
        </div>
      )}

      {/* Minimal header */}
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
