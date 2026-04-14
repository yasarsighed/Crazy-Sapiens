import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StudyCard } from '@/components/study-card'
import { EmptyState } from '@/components/empty-state'
import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Study } from '@/types/database'

export default async function StudiesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile for researcher color
  const { data: profile } = await supabase
    .from('profiles')
    .select('researcher_color')
    .eq('id', user.id)
    .single()

  // Fetch all studies for this researcher
  const { data: studies } = await supabase
    .from('studies')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  // Fetch study instruments
  const studyIds = studies?.map(s => s.id) || []
  const { data: studyInstruments } = studyIds.length > 0 
    ? await supabase
        .from('study_instruments')
        .select('*')
        .in('study_id', studyIds)
    : { data: [] }

  const researcherColor = profile?.researcher_color || '#2D6A4F'

  // Group instruments by study
  const instrumentsByStudy = (studyInstruments || []).reduce((acc, inst) => {
    if (!acc[inst.study_id]) acc[inst.study_id] = []
    acc[inst.study_id].push({ type: inst.instrument_type })
    return acc
  }, {} as Record<string, Array<{ type: 'questionnaire' | 'iat' | 'sociogram' }>>)

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Studies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your experiments, all in one place.
          </p>
        </div>
        <Button asChild>
          <Link href="/studies/new">
            <Plus className="w-4 h-4 mr-2" />
            New study
          </Link>
        </Button>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search studies..." 
            className="pl-10"
          />
        </div>
      </div>

      {/* Studies grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {studies && studies.length > 0 ? (
          studies.map((study: Study) => (
            <StudyCard
              key={study.id}
              id={study.id}
              title={study.title}
              instruments={instrumentsByStudy[study.id] || []}
              participantCount={study.participant_count || 0}
              completionPercentage={study.completion_percentage || 0}
              researcherColor={researcherColor}
            />
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="py-12">
              <EmptyState
                title="No studies yet."
                subtitle="Create your first study to start collecting data."
              />
              <div className="flex justify-center mt-6">
                <Button asChild>
                  <Link href="/studies/new">
                    <Plus className="w-4 h-4 mr-2" />
                    Create your first study
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
