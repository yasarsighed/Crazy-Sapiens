import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FlaskConical, CheckCircle, AlertCircle, Clock, ListChecks, ShieldCheck, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function JoinStudyPage({
  params,
}: {
  params: Promise<{ studyId: string }>
}) {
  const { studyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=/participant/join/${studyId}`)
  }

  // Fetch study
  const { data: study } = await supabase
    .from('studies')
    .select('id, title, description, status')
    .eq('id', studyId)
    .single()

  if (!study) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
        <h1 className="font-serif text-xl mb-2">Study not found</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This invitation link may be invalid or the study may have been removed.
        </p>
        <Button asChild variant="outline">
          <Link href="/participant/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    )
  }

  if (study.status !== 'active') {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
        <h1 className="font-serif text-xl mb-2">Study not accepting participants</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This study is currently {study.status}. Please contact your researcher.
        </p>
        <Button asChild variant="outline">
          <Link href="/participant/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    )
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('study_enrollments')
    .select('id, status')
    .eq('study_id', studyId)
    .eq('participant_id', user.id)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'withdrawn') {
      return (
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
          <h1 className="font-serif text-xl mb-2">Previously withdrawn</h1>
          <p className="text-sm text-muted-foreground mb-6">
            You previously withdrew from &ldquo;{study.title}&rdquo;. If you would like to
            re-enrol, please contact your researcher directly.
          </p>
          <Button asChild variant="outline">
            <Link href="/participant/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      )
    }

    // Already active — redirect to dashboard
    redirect('/participant/dashboard')
  }

  // Check if user has participant role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'participant') {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
        <h1 className="font-serif text-xl mb-2">Researcher account detected</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This invitation is for participants. You are signed in as a researcher.
          Please use a participant account to join this study.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to researcher dashboard</Link>
        </Button>
      </div>
    )
  }

  // ── "What to expect" — count the study's instruments and estimate time ──────
  const [{ data: qs }, { count: socCount }, { count: iatCount }] = await Promise.all([
    supabase.from('questionnaire_instruments')
      .select('estimated_duration_minutes')
      .eq('study_id', studyId).eq('status', 'active'),
    supabase.from('sociogram_instruments')
      .select('*', { count: 'exact', head: true })
      .eq('study_id', studyId).eq('status', 'active'),
    supabase.from('iat_instruments')
      .select('*', { count: 'exact', head: true })
      .eq('study_id', studyId),
  ])

  const qCount = qs?.length ?? 0
  const socN = socCount ?? 0
  const iatN = iatCount ?? 0
  const totalTasks = qCount + socN + iatN

  // Estimate total minutes: questionnaire durations (default 5 each) + soc (~3) + iat (~5)
  const qMinutes = (qs ?? []).reduce((sum, q: any) => sum + (q.estimated_duration_minutes ?? 5), 0)
  const estMinutes = qMinutes + socN * 3 + iatN * 5

  // Server action: enrol only when the participant explicitly confirms.
  async function joinStudy() {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect(`/login?redirect=/participant/join/${studyId}`)
    await supabase
      .from('study_enrollments')
      .insert({
        study_id: studyId,
        participant_id: user.id,
        status: 'active',
        enrolled_at: new Date().toISOString(),
      })
    redirect('/participant/dashboard')
  }

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      {/* Study header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <FlaskConical className="w-7 h-7 text-primary" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">You&rsquo;re invited to join</p>
        <h1 className="font-serif text-2xl text-foreground mb-3">{study.title}</h1>
        {study.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {study.description}
          </p>
        )}
      </div>

      {/* What to expect */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-5">
        <h2 className="font-serif text-base font-semibold text-foreground mb-4">What to expect</h2>
        <ul className="space-y-4">
          <li className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ListChecks className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {totalTasks > 0 ? `${totalTasks} task${totalTasks > 1 ? 's' : ''} to complete` : 'Tasks added by your researcher'}
              </p>
              <p className="text-sm text-muted-foreground">
                {totalTasks > 0
                  ? [qCount && `${qCount} questionnaire${qCount > 1 ? 's' : ''}`, socN && `${socN} peer nomination${socN > 1 ? 's' : ''}`, iatN && `${iatN} reaction task${iatN > 1 ? 's' : ''}`].filter(Boolean).join(' · ')
                  : 'Your researcher may add tasks over time.'}
              </p>
            </div>
          </li>
          {estMinutes > 0 && (
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #F0A65C 12%, var(--card))' }}>
                <Clock className="w-4 h-4" style={{ color: '#F0A65C' }} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">About {estMinutes} minute{estMinutes > 1 ? 's' : ''} in total</p>
                <p className="text-sm text-muted-foreground">You can pause and finish later — your progress is saved.</p>
              </div>
            </li>
          )}
          <li className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #C6A8F0 12%, var(--card))' }}>
              <ShieldCheck className="w-4 h-4" style={{ color: '#C6A8F0' }} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Your data is kept secure</p>
              <p className="text-sm text-muted-foreground">Responses are stored securely and used only for research.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #86C99A 12%, var(--card))' }}>
              <LogOut className="w-4 h-4" style={{ color: '#86C99A' }} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">You can withdraw anytime</p>
              <p className="text-sm text-muted-foreground">Leave from your dashboard whenever you like — your data is deleted on request.</p>
            </div>
          </li>
        </ul>
      </div>

      <p className="text-xs text-muted-foreground text-center mb-5 leading-relaxed">
        Before your first task you&rsquo;ll be asked to review and give informed consent.
      </p>

      {/* Join action */}
      <form action={joinStudy}>
        <Button type="submit" size="lg" className="w-full gap-2">
          <CheckCircle className="w-4 h-4" />
          Join this study
        </Button>
      </form>
      <div className="text-center mt-3">
        <Link href="/participant/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Not now
        </Link>
      </div>
    </div>
  )
}
