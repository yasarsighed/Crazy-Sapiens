import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import type { Profile } from '@/types/database'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Participants go to their own portal
  if (profile?.role === 'participant') {
    redirect('/participant/dashboard')
  }

  const role = profile?.role || 'researcher'
  const researcherColor = profile?.researcher_color || '#6D28D9'

  return (
    <div
      className={`min-h-screen bg-background role-${role}`}
      style={{ '--researcher-color': researcherColor } as React.CSSProperties}
    >
      <Sidebar profile={profile as Profile | null} />
      <main className="ml-[240px] min-h-screen">
        {children}
      </main>
    </div>
  )
}
