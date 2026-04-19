import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function InstrumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: studies } = await supabase
    .from('studies')
    .select('id')
    .eq('created_by', user.id)

  const studyIds = studies?.map(s => s.id) || []

  const { data: instruments } = studyIds.length > 0
    ? await supabase
        .from('study_instruments')
        .select('*, studies(title)')
        .in('study_id', studyIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground">Instruments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {instruments?.length ? `${instruments.length} instruments across your studies` : 'No instruments yet.'}
        </p>
      </div>

      {instruments && instruments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instruments.map((instrument: any) => (
            <Card key={instrument.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="font-serif text-base leading-snug">
                    {instrument.instrument_label}
                  </CardTitle>
                  <Badge variant="outline" className="ml-2 shrink-0">
                    {instrument.instrument_type?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{instrument.studies?.title}</p>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {instrument.is_active ? 'Active' : 'Inactive'} · {instrument.is_mandatory ? 'Mandatory' : 'Optional'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-serif text-xl text-foreground mb-2">No instruments yet.</p>
          <p className="text-sm italic text-muted-foreground">Add instruments to your studies to see them here.</p>
        </div>
      )}
    </div>
  )
}