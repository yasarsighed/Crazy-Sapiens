import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { ArrowLeft, Users, FileText, Brain, Network, Settings, Play, Pause } from 'lucide-react'

const instrumentIcons = {
  questionnaire: FileText,
  iat: Brain,
  sociogram: Network,
}

const instrumentLabels = {
  questionnaire: 'Questionnaire',
  iat: 'IAT',
  sociogram: 'Sociogram',
}

interface StudyPageProps {
  params: Promise<{ id: string }>
}

export default async function StudyPage({ params }: StudyPageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch the study
  const { data: study, error } = await supabase
    .from('studies')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !study) {
    notFound()
  }

  // Fetch profile for researcher color
  const { data: profile } = await supabase
    .from('profiles')
    .select('researcher_color')
    .eq('id', user.id)
    .single()

  // Fetch instruments for this study
  const { data: instruments } = await supabase
    .from('study_instruments')
    .select('*')
    .eq('study_id', id)

  // Fetch enrollment count
  const { count: enrollmentCount } = await supabase
    .from('study_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('study_id', id)

  const researcherColor = profile?.researcher_color || '#2D6A4F'

  const statusColors = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-success/10 text-success',
    paused: 'bg-accent-yellow/20 text-accent-yellow',
    completed: 'bg-primary/10 text-primary',
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Back link */}
      <Link 
        href="/studies"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to studies
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-serif text-2xl text-foreground">{study.title}</h1>
            <Badge 
              variant="secondary"
              className={`text-[10px] capitalize ${statusColors[study.status as keyof typeof statusColors] || ''}`}
            >
              {study.status || 'draft'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {study.description || 'No description provided.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {study.status === 'active' ? (
            <Button variant="outline">
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          ) : (
            <Button style={{ backgroundColor: researcherColor }}>
              <Play className="w-4 h-4 mr-2" />
              {study.status === 'draft' ? 'Launch' : 'Resume'}
            </Button>
          )}
          <Button variant="ghost" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-serif" style={{ color: researcherColor }}>
              {enrollmentCount || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-serif" style={{ color: researcherColor }}>
              {study.completion_percentage || 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Instruments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-serif" style={{ color: researcherColor }}>
              {instruments?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Instruments */}
      <h2 className="font-serif text-lg text-foreground mb-4">Instruments</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {instruments && instruments.length > 0 ? (
          instruments.map((instrument: any) => {
            const Icon = instrumentIcons[instrument.instrument_type as keyof typeof instrumentIcons] || FileText
            return (
              <Card key={instrument.id} className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${researcherColor}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: researcherColor }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {instrumentLabels[instrument.instrument_type as keyof typeof instrumentLabels] || instrument.instrument_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Configure instrument
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card className="col-span-full">
            <CardContent className="py-8">
              <EmptyState
                title="No instruments configured."
                subtitle="Add questionnaires, IATs, or sociograms to your study."
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Danger zone */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>Irreversible actions. Handle with care.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10">
            Delete study
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
