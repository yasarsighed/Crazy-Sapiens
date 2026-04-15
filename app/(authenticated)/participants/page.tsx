import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function ParticipantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: studies } = await supabase
    .from('studies')
    .select('id')
    .eq('created_by', user.id)

  const studyIds = studies?.map(s => s.id) || []

  const { data: enrollments } = studyIds.length > 0
    ? await supabase
        .from('study_enrollments')
        .select('*, profiles(full_name, email), studies(title)')
        .in('study_id', studyIds)
        .order('enrolled_at', { ascending: false })
    : { data: [] }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground">Participants</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {enrollments?.length ? `${enrollments.length} brave souls enrolled` : 'Nobody here yet.'}
        </p>
      </div>

      {enrollments && enrollments.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">All participants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {enrollments.map((enrollment: any) => (
                <div key={enrollment.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ backgroundColor: '#2D6A4F' }}
                    >
                      {enrollment.profiles?.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{enrollment.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{enrollment.profiles?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">{enrollment.studies?.title}</p>
                    <Badge variant={enrollment.status === 'active' ? 'default' : 'secondary'}>
                      {enrollment.status === 'active' ? 'Getting there...' : enrollment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-serif text-xl text-foreground mb-2">Nobody here yet.</p>
          <p className="text-sm italic text-muted-foreground">They will come. Give it time.</p>
        </div>
      )}
    </div>
  )
}