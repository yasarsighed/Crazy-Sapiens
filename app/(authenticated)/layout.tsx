import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { GlobalProviders } from '@/components/global-providers'
import { OnboardingChecklist } from '@/components/onboarding-checklist'
import { deriveCustomTheme, customThemeToCSSVars } from '@/lib/custom-theme'
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
  const researcherColor = profile?.researcher_color || '#CE2029'
  const isNewUser = !profile?.researcher_color // no color set = likely new

  // Custom background: computed server-side from the same DB value on every
  // render, so there's no client/server mismatch risk (unlike Math.random()
  // content elsewhere, this is deterministic). Derives a full contrast-safe
  // token set rather than just swapping --background, so text/cards/borders
  // stay legible against whatever color the researcher picked — see
  // lib/custom-theme.ts for the WCAG-contrast guarantee this relies on.
  const customBg = (profile?.dashboard_prefs as { bgColor?: string | null } | null)?.bgColor
  const customThemeStyle = customBg ? customThemeToCSSVars(deriveCustomTheme(customBg)) : {}

  return (
    <GlobalProviders>
      <div
        data-app-shell
        className={`min-h-screen bg-background role-${role}`}
        style={{ '--researcher-color': researcherColor, ...customThemeStyle } as React.CSSProperties}
      >
        <Sidebar profile={profile as Profile | null} />
        <main id="main-content" className="ml-[240px] min-h-screen">
          {children}
        </main>
        {/* Onboarding for new researchers */}
        {(role === 'researcher' || role === 'admin') && isNewUser && (
          <OnboardingChecklist />
        )}
      </div>
    </GlobalProviders>
  )
}
