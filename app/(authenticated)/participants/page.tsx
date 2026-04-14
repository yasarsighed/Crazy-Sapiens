import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Users } from 'lucide-react'

export default async function ParticipantsPage() {
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

  // Fetch enrollments with participant info
  const { data: enrollments } = studyIds.length > 0
    ? await supabase
        .from('study_enrollments')
        .select('*, participants(*)')
        .in('study_id', studyIds)
        .order('enrolled_at', { ascending: false })
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
          <h1 className="font-serif text-2xl text-foreground">Participants</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The brave souls who signed up for your studies.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search participants..." 
            className="pl-10"
          />
        </div>
      </div>

      {/* Participants table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            All enrollments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments && enrollments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Participant ID</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Study</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Enrolled</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enrollment: any) => (
                    <tr key={enrollment.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {enrollment.participant_id?.slice(0, 8)}...
                        </code>
                      </td>
                      <td className="py-3 px-4 text-foreground">
                        {studyTitles[enrollment.study_id] || 'Unknown study'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(enrollment.enrolled_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          variant={enrollment.status === 'completed' ? 'default' : 'secondary'}
                          className="text-[10px]"
                          style={enrollment.status === 'completed' ? { backgroundColor: researcherColor } : {}}
                        >
                          {enrollment.status || 'enrolled'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No participants yet."
              subtitle="Once participants enroll in your studies, they will appear here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
