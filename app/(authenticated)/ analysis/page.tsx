import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function AnalysisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: studies } = await supabase
    .from('studies')
    .select('id')
    .eq('created_by', user.id)

  const studyIds = studies?.map(s => s.id) || []

  const { data: projects } = studyIds.length > 0
    ? await supabase
        .from('analysis_projects')
        .select('*, studies(title)')
        .in('study_id', studyIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects?.length ? `${projects.length} analyses running` : 'No analyses yet.'}
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New analysis
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: any) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="font-serif text-base leading-snug">
                    {project.title}
                  </CardTitle>
                  <Badge variant={project.status === 'completed' ? 'default' : 'secondary'} className="ml-2 shrink-0">
                    {project.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{project.studies?.title}</p>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {project.analysis_type?.replace(/_/g, ' ')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-serif text-xl text-foreground mb-2">No analyses yet.</p>
          <p className="text-sm italic text-muted-foreground">The data awaits its moment of truth.</p>
        </div>
      )}
    </div>
  )
}