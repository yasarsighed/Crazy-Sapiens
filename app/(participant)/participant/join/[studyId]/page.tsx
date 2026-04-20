import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FlaskConical, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function JoinStudyPage({
  params,
}: {
  params: { studyId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login, then come back here after login
    redirect(`/login?redirect=/participant/join/${params.studyId}`)
  }

  const { studyId } = params

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

  // Auto-enrol the participant
  const { error: enrollError } = await supabase
    .from('study_enrollments')
    .insert({
      study_id: studyId,
      participant_id: user.id,
      status: 'active',
      enrolled_at: new Date().toISOString(),
    })

  if (enrollError) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-4 text-destructive" />
        <h1 className="font-serif text-xl mb-2">Enrolment failed</h1>
        <p className="text-sm text-muted-foreground mb-2">
          {enrollError.message}
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Please contact your researcher.
        </p>
        <Button asChild variant="outline">
          <Link href="/participant/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-7 h-7 text-primary" />
      </div>
      <h1 className="font-serif text-2xl mb-2">You&rsquo;re enrolled</h1>
      <div className="flex items-center justify-center gap-2 mb-4">
        <FlaskConical className="w-4 h-4 text-muted-foreground" />
        <p className="text-base font-medium text-foreground">{study.title}</p>
      </div>
      {study.description && (
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {study.description}
        </p>
      )}
      <p className="text-sm text-muted-foreground mb-8">
        Your researcher has added you to this study. Head to your dashboard to see
        your instruments and get started.
      </p>
      <Button asChild size="lg" className="w-full">
        <Link href="/participant/dashboard">Go to my dashboard</Link>
      </Button>
    </div>
  )
}
