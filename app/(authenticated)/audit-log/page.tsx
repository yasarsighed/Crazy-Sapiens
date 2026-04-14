import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, ClipboardList } from 'lucide-react'

export default async function AuditLogPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('researcher_color')
    .eq('id', user.id)
    .single()

  // Fetch audit log entries
  const { data: auditLogs } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  const researcherColor = profile?.researcher_color || '#2D6A4F'

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-success/10 text-success'
      case 'update': return 'bg-accent-yellow/20 text-accent-yellow'
      case 'delete': return 'bg-destructive/10 text-destructive'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A complete record of all platform activity.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search logs..." 
            className="pl-10"
          />
        </div>
      </div>

      {/* Audit log table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs && auditLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Action</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Entity</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log: any) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          variant="secondary"
                          className={`text-[10px] ${getActionColor(log.action_type)}`}
                        >
                          {log.action_type || 'action'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-foreground">
                        {log.entity_type || '--'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs max-w-[200px] truncate">
                        {log.entity_id ? `ID: ${log.entity_id.slice(0, 8)}...` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No activity recorded."
              subtitle="Actions will be logged here as they happen."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
