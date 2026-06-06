import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/logo'
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
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 30%, #f0f9ff 70%, #faf5ff 100%)' }}>

      {/* Researcher preview banner */}
      {isResearcher && (
        <div className="bg-amber-500 px-4 py-2 flex items-center justify-between gap-4">
          <p className="text-xs text-white font-medium">
            👁️ <strong>Researcher preview</strong> — you are seeing the participant portal as <strong>{profile?.full_name ?? user.email}</strong>
          </p>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs font-bold text-white hover:text-amber-100 whitespace-nowrap transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to dashboard
          </Link>
        </div>
      )}

      {/* Sticky header */}
      <header className="border-b border-emerald-100/60 bg-white/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <Logo size="sm" />
          <Link
            href="/participant/profile"
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-900 transition-colors bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full"
          >
            <User className="w-3 h-3" />
            My Profile
          </Link>
        </div>
      </header>

      <main className="pb-16">{children}</main>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-emerald-100/60 bg-white/80 backdrop-blur-md py-2">
        <p className="text-center text-[10px] text-emerald-700/60 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3" />
          Your responses support meaningful research. Thank you for contributing.
        </p>
      </div>
    </div>
  )
}
