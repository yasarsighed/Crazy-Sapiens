'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Loader2 } from 'lucide-react'

const instrumentTypes = [
  { id: 'questionnaire', label: 'Questionnaire', description: 'Self-report scales and surveys' },
  { id: 'iat', label: 'IAT', description: 'Implicit Association Test' },
  { id: 'sociogram', label: 'Sociogram', description: 'Social network mapping' },
]

export default function NewStudyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instruments: [] as string[],
  })

  const handleInstrumentToggle = (instrumentId: string) => {
    setFormData(prev => ({
      ...prev,
      instruments: prev.instruments.includes(instrumentId)
        ? prev.instruments.filter(id => id !== instrumentId)
        : [...prev.instruments, instrumentId]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Create the study
      const { data: study, error: studyError } = await supabase
        .from('studies')
        .insert({
          title: formData.title,
          description: formData.description,
          created_by: user.id,
          status: 'draft',
        })
        .select()
        .single()

      if (studyError) throw studyError

      // Add instruments
      if (formData.instruments.length > 0 && study) {
        const instrumentsToInsert = formData.instruments.map(type => ({
          study_id: study.id,
          instrument_type: type,
        }))

        const { error: instrumentsError } = await supabase
          .from('study_instruments')
          .insert(instrumentsToInsert)

        if (instrumentsError) throw instrumentsError
      }

      router.push(`/studies/${study.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create study')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      {/* Back link */}
      <Link 
        href="/studies"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to studies
      </Link>

      <h1 className="font-serif text-2xl text-foreground mb-2">New study</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Set up your experiment. You can always change these settings later.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription>What is this study about?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Study title</Label>
              <Input
                id="title"
                placeholder="e.g., Social Anxiety and Group Dynamics"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Briefly describe the purpose and methodology of your study..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instruments</CardTitle>
            <CardDescription>Select the data collection methods you will use.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {instrumentTypes.map((instrument) => (
              <div
                key={instrument.id}
                className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleInstrumentToggle(instrument.id)}
              >
                <Checkbox
                  id={instrument.id}
                  checked={formData.instruments.includes(instrument.id)}
                  onCheckedChange={() => handleInstrumentToggle(instrument.id)}
                />
                <div className="flex-1">
                  <label htmlFor={instrument.id} className="text-sm font-medium cursor-pointer">
                    {instrument.label}
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {instrument.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isLoading || !formData.title}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create study
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/studies">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
