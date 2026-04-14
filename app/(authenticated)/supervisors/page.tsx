import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Shield, Plus } from 'lucide-react'

export default async function SupervisorsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('researcher_color')
    .eq('id', user.id)
    .single()

  // Fetch supervisors (users with supervisor role)
  const { data: supervisors } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'supervisor')
    .order('created_at', { ascending: false })

  const researcherColor = profile?.researcher_color || '#2D6A4F'

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Supervisors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Clinical supervisors who review alerts and monitor participant wellbeing.
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add supervisor
        </Button>
      </div>

      {/* Info card */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">About Supervisors</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supervisors have elevated access to clinical alerts and can acknowledge flags that indicate participant distress. They do not have access to raw data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supervisors list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Active supervisors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {supervisors && supervisors.length > 0 ? (
            <div className="space-y-3">
              {supervisors.map((supervisor: any) => (
                <div 
                  key={supervisor.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: supervisor.researcher_color || researcherColor }}
                    >
                      {supervisor.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {supervisor.full_name || 'Unnamed Supervisor'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(supervisor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Manage
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No supervisors assigned."
              subtitle="Add clinical supervisors to receive and manage alerts."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
