import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Brain, Network } from 'lucide-react'

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

export default async function InstrumentsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile for researcher color
  const { data: profile } = await supabase
    .from('profiles')
    .select('researcher_color')
    .eq('id', user.id)
    .single()

  // Fetch studies owned by this researcher
  const { data: studies } = await supabase
    .from('studies')
    .select('id, title')
    .eq('created_by', user.id)

  const studyIds = studies?.map(s => s.id) || []

  // Fetch all instruments for the researcher&apos;s studies
  const { data: instruments } = studyIds.length > 0
    ? await supabase
        .from('study_instruments')
        .select('*')
        .in('study_id', studyIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const researcherColor = profile?.researcher_color || '#2D6A4F'

  // Map study IDs to titles
  const studyTitles = (studies || []).reduce((acc, s) => {
    acc[s.id] = s.title
    return acc
  }, {} as Record<string, string>)

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Instruments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your measurement tools across all studies.
          </p>
        </div>
        <Button asChild>
          <Link href="/scale-library">
            <Plus className="w-4 h-4 mr-2" />
            Browse scale library
          </Link>
        </Button>
      </div>

      {/* Instruments grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {instruments && instruments.length > 0 ? (
          instruments.map((instrument: any) => {
            const Icon = instrumentIcons[instrument.instrument_type as keyof typeof instrumentIcons] || FileText
            return (
              <Card key={instrument.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${researcherColor}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: researcherColor }} />
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {instrumentLabels[instrument.instrument_type as keyof typeof instrumentLabels] || instrument.instrument_type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-foreground mb-1">
                    {instrument.name || `${instrumentLabels[instrument.instrument_type as keyof typeof instrumentLabels]} Instrument`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Used in: {studyTitles[instrument.study_id] || 'Unknown study'}
                  </p>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card className="col-span-full">
            <CardContent className="py-12">
              <EmptyState
                title="No instruments configured."
                subtitle="Add instruments to your studies to see them here."
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
