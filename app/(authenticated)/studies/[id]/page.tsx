'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Network, Download, Plus, X, ChevronDown,
  ClipboardList, Users, Timer, ExternalLink, Trash2, Link2, FileText, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { AddQuestionnaireDialog } from '@/components/add-questionnaire-dialog'
import { AddSociogramDialog } from '@/components/add-sociogram-dialog'
import { AddIatDialog } from '@/components/add-iat-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Instrument {
  id: string
  title: string
  type: 'questionnaire' | 'sociogram' | 'iat'
  status: string
}

export default function StudyPage() {
  const params = useParams()
  const router = useRouter()
  const studyId = params.id as string
  const [study, setStudy] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [showAddQuestionnaire, setShowAddQuestionnaire] = useState(false)
  const [showAddSociogram, setShowAddSociogram] = useState(false)
  const [showAddIat, setShowAddIat] = useState(false)
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deletingStudy, setDeletingStudy] = useState(false)
  const [showDeleteStudyConfirm, setShowDeleteStudyConfirm] = useState(false)
  const [showConsentEditor, setShowConsentEditor] = useState(false)
  const [manualMode, setManualMode] = useState<'existing' | 'single' | 'bulk'>('existing')
  const [bulkText, setBulkText] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkResults, setBulkResults] = useState<Array<{ email: string; ok: boolean; temp_password?: string; error?: string }> | null>(null)
  const [manualEmail, setManualEmail] = useState('')
  const [manualName, setManualName] = useState('')
  const [creatingManual, setCreatingManual] = useState(false)

  const createManualParticipant = async () => {
    if (!manualEmail.trim() || !manualName.trim()) {
      toast.error('Email and name required')
      return
    }
    setCreatingManual(true)
    try {
      const res = await fetch('/api/participants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: manualEmail.trim(),
          full_name: manualName.trim(),
          study_id: studyId,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error('Failed to create participant', { description: body.error })
      } else {
        toast.success('Invitation sent', {
          description: `${manualEmail.trim()} will receive an email to set up their account.`,
        })
        setManualEmail('')
        setManualName('')
        await loadData()
      }
    } finally {
      setCreatingManual(false)
    }
  }
  const [consentText, setConsentText] = useState('')
  const [savingConsent, setSavingConsent] = useState(false)
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false)

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: studyData } = await supabase
      .from('studies')
      .select('*')
      .eq('id', studyId)
      .single()
    setStudy(studyData)
    setConsentText(studyData?.consent_text ?? '')

    const { data: enrollments } = await supabase
      .from('study_enrollments')
      .select('id, participant_id, status, profiles!study_enrollments_participant_id_fkey(full_name, email)')
      .eq('study_id', studyId)
    setParticipants(enrollments || [])

    // Query all 3 instrument tables directly — bypasses any study_instruments RLS issues
    const [qRes, socRes, iatRes] = await Promise.all([
      supabase.from('questionnaire_instruments').select('id, title, status').eq('study_id', studyId),
      supabase.from('sociogram_instruments').select('id, title').eq('study_id', studyId),
      supabase.from('iat_instruments').select('id, title').eq('study_id', studyId),
    ])

    const merged: Instrument[] = [
      ...(qRes.data || []).map(i => ({ id: i.id, title: i.title, type: 'questionnaire' as const, status: i.status ?? 'active' })),
      ...(socRes.data || []).map(i => ({ id: i.id, title: i.title, type: 'sociogram' as const, status: 'active' })),
      ...(iatRes.data || []).map(i => ({ id: i.id, title: i.title, type: 'iat' as const, status: 'active' })),
    ]
    setInstruments(merged)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [studyId])

  const openAddParticipant = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('*').eq('role', 'participant').order('full_name')
    setAllProfiles(data || [])
    setShowAddParticipant(true)
  }

  const addParticipant = async (profileId: string) => {
    setAdding(true)
    const supabase = createClient()
    const { error } = await supabase.from('study_enrollments').insert({
      study_id: studyId,
      participant_id: profileId,
      status: 'active',
      enrolled_at: new Date().toISOString(),
    })
    if (error) {
      toast.error('Could not add participant', { description: error.message })
    } else {
      fetch('/api/activity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enrollment',
          entity: 'participant',
          entityId: profileId,
          details: { study_id: studyId },
        }),
      }).catch(() => {})
      toast.success('Participant added to study')
      await loadData()
      setShowAddParticipant(false)
    }
    setAdding(false)
  }

  const deleteInstrument = async (id: string, type: 'questionnaire' | 'sociogram' | 'iat', title: string) => {
    if (!window.confirm(`Remove "${title}"?\n\nAll responses, scores, and alerts for this instrument will be permanently deleted. This cannot be undone.`)) return
    setDeleting(id)
    const supabase = createClient()

    // Cascade: delete all dependent data before the instrument row
    if (type === 'questionnaire') {
      await supabase.from('clinical_alerts_log').delete().eq('questionnaire_id', id)
      await supabase.from('questionnaire_scored_results').delete().eq('questionnaire_id', id)
      await supabase.from('questionnaire_item_responses').delete().eq('questionnaire_id', id)
    } else if (type === 'iat') {
      await supabase.from('iat_session_results').delete().eq('iat_id', id)
      await supabase.from('iat_trial_log').delete().eq('iat_id', id)
    } else if (type === 'sociogram') {
      await supabase.from('sociogram_nominations').delete().eq('sociogram_id', id)
      await supabase.from('sociogram_participants').delete().eq('sociogram_id', id)
    }

    const table =
      type === 'questionnaire' ? 'questionnaire_instruments'
      : type === 'sociogram'   ? 'sociogram_instruments'
      : 'iat_instruments'

    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      toast.error('Failed to remove instrument', { description: error.message })
    } else {
      await supabase.from('study_instruments').delete().eq('instrument_id', id)
      fetch('/api/activity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'instrument_deleted',
          entity: type,
          entityId: id,
          details: { title, study_id: studyId },
        }),
      }).catch(() => {})
      toast.success('Instrument removed')
      await loadData()
    }
    setDeleting(null)
  }

  const deleteStudy = async () => {
    setDeletingStudy(true)
    const supabase = createClient()

    // Delete all questionnaire data
    for (const inst of instruments.filter(i => i.type === 'questionnaire')) {
      await supabase.from('clinical_alerts_log').delete().eq('questionnaire_id', inst.id)
      await supabase.from('questionnaire_scored_results').delete().eq('questionnaire_id', inst.id)
      await supabase.from('questionnaire_item_responses').delete().eq('questionnaire_id', inst.id)
      await supabase.from('questionnaire_instruments').delete().eq('id', inst.id)
    }
    // Delete all IAT data
    for (const inst of instruments.filter(i => i.type === 'iat')) {
      await supabase.from('iat_session_results').delete().eq('iat_id', inst.id)
      await supabase.from('iat_trial_log').delete().eq('iat_id', inst.id)
      await supabase.from('iat_instruments').delete().eq('id', inst.id)
    }
    // Delete all sociogram data
    for (const inst of instruments.filter(i => i.type === 'sociogram')) {
      await supabase.from('sociogram_nominations').delete().eq('sociogram_id', inst.id)
      await supabase.from('sociogram_participants').delete().eq('sociogram_id', inst.id)
      await supabase.from('sociogram_instruments').delete().eq('id', inst.id)
    }

    await supabase.from('study_instruments').delete().eq('study_id', studyId)
    await supabase.from('study_enrollments').delete().eq('study_id', studyId)

    const { error } = await supabase.from('studies').delete().eq('id', studyId)
    if (error) {
      toast.error('Failed to delete study', { description: error.message })
      setDeletingStudy(false)
      setShowDeleteStudyConfirm(false)
    } else {
      toast.success('Study deleted')
      router.push('/studies')
    }
  }

  const saveConsentText = async () => {
    setSavingConsent(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('studies')
      .update({ consent_text: consentText.trim() || null })
      .eq('id', studyId)
    if (error) {
      toast.error('Failed to save consent text', { description: error.message })
    } else {
      toast.success('Consent text saved')
      setShowConsentEditor(false)
      await loadData()
    }
    setSavingConsent(false)
  }

  const copyInviteLink = () => {
    const url = `${window.location.origin}/participant/join/${studyId}`
    navigator.clipboard.writeText(url).then(() => {
      setInviteLinkCopied(true)
      setTimeout(() => setInviteLinkCopied(false), 2000)
    })
  }

  const enrolledIds = participants.map(p => p.participant_id)
  const filteredProfiles = allProfiles.filter(p =>
    !enrolledIds.includes(p.id) &&
    (p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
     p.email?.toLowerCase().includes(search.toLowerCase()))
  )

  const hasSociogram = instruments.some(i => i.type === 'sociogram')

  if (loading) return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Loading study...</div>
  if (!study) return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Study not found.</div>

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/studies" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to studies
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-foreground">{study.title}</h1>
            {study.description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">{study.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={study.status}
              onChange={async (e) => {
                const next = e.target.value
                const supabase = createClient()
                const { error } = await supabase.from('studies').update({ status: next }).eq('id', studyId)
                if (error) toast.error('Failed to update status', { description: error.message })
                else {
                  toast.success(`Study is now ${next}`)
                  fetch('/api/activity/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'study_updated', entity: 'study', entityId: studyId, details: { status: next } }),
                  }).catch(() => {})
                  await loadData()
                }
              }}
              className={`text-xs rounded-md px-2.5 py-1 font-medium border ${
                study.status === 'active' ? 'bg-primary/10 text-primary border-primary/30'
                : study.status === 'draft' ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
            <button
              onClick={() => setShowDeleteStudyConfirm(true)}
              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              title="Delete study"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-3 mb-8">
        {hasSociogram && (
          <Button asChild>
            <Link href={`/studies/${studyId}/sociogram`}>
              <Network className="w-4 h-4 mr-2" />
              View Sociogram
            </Link>
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            const a = document.createElement('a')
            a.href = `/api/export/${studyId}`
            a.click()
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const a = document.createElement('a')
            a.href = `/api/export/${studyId}/codebook`
            a.click()
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          Codebook
        </Button>
        <Button variant="outline" onClick={copyInviteLink}>
          <Link2 className="w-4 h-4 mr-2" />
          {inviteLinkCopied ? 'Copied!' : 'Copy invite link'}
        </Button>
        <Button variant="outline" onClick={() => setShowConsentEditor(v => !v)}>
          <FileText className="w-4 h-4 mr-2" />
          {study?.consent_text ? 'Edit consent text' : 'Add consent text'}
        </Button>
      </div>

      {/* Consent text editor */}
      {showConsentEditor && (
        <div className="border border-border rounded-xl p-5 mb-6">
          <h2 className="font-serif text-base font-semibold mb-1">Informed consent text</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Participants will read this before their first instrument. Leave blank to use the default
            consent statement. Plain text only — formatting is preserved.
          </p>
          <textarea
            value={consentText}
            onChange={e => setConsentText(e.target.value)}
            rows={8}
            placeholder="Paste or type your study-specific consent statement here…"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-y mb-3"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveConsentText} disabled={savingConsent}>
              {savingConsent ? 'Saving…' : 'Save consent text'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowConsentEditor(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Participants */}
        <div className="border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-base font-semibold">Participants ({participants.length})</h2>
            <Button size="sm" variant="outline" onClick={openAddParticipant}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No participants yet. They will come.</p>
          ) : (
            <div className="space-y-1">
              {participants.map((enrollment: any) => (
                <div key={enrollment.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                    style={{ backgroundColor: '#2D6A4F' }}
                  >
                    {enrollment.profiles?.full_name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{enrollment.profiles?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{enrollment.profiles?.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{enrollment.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instruments */}
        <div className="border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-base font-semibold">Instruments ({instruments.length})</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowAddQuestionnaire(true)}>
                  <ClipboardList className="w-4 h-4 mr-2 text-[#457B9D]" />
                  Questionnaire
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddSociogram(true)}>
                  <Users className="w-4 h-4 mr-2 text-[#2D6A4F]" />
                  Sociogram
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddIat(true)}>
                  <Timer className="w-4 h-4 mr-2 text-[#F4A261]" />
                  IAT
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {instruments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No instruments yet. Add one to get started.</p>
          ) : (
            <div className="space-y-1">
              {instruments.map((instrument) => {
                const typeAccent =
                  instrument.type === 'questionnaire' ? '#457B9D'
                  : instrument.type === 'iat'          ? '#F4A261'
                  : '#2D6A4F'

                const typeIcon =
                  instrument.type === 'questionnaire' ? <ClipboardList className="w-3.5 h-3.5 shrink-0" style={{ color: typeAccent }} />
                  : instrument.type === 'iat'          ? <Timer className="w-3.5 h-3.5 shrink-0" style={{ color: typeAccent }} />
                  : <Users className="w-3.5 h-3.5 shrink-0" style={{ color: typeAccent }} />

                const resultsHref =
                  instrument.type === 'questionnaire'
                    ? `/studies/${studyId}/questionnaire/${instrument.id}`
                    : instrument.type === 'iat'
                    ? `/studies/${studyId}/iat/${instrument.id}`
                    : `/studies/${studyId}/sociogram`

                return (
                  <div
                    key={instrument.id}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: typeAccent }} />
                    {typeIcon}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{instrument.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{instrument.type}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={resultsHref}
                        className="flex items-center gap-1 text-xs text-primary hover:underline px-1.5 py-1 rounded hover:bg-primary/5"
                      >
                        Results <ExternalLink className="w-3 h-3" />
                      </Link>
                      <button
                        onClick={() => deleteInstrument(instrument.id, instrument.type, instrument.title)}
                        disabled={deleting === instrument.id}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-40"
                        title="Remove instrument"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AddQuestionnaireDialog studyId={studyId} open={showAddQuestionnaire} onClose={() => setShowAddQuestionnaire(false)} onSuccess={loadData} />
      <AddSociogramDialog    studyId={studyId} open={showAddSociogram}    onClose={() => setShowAddSociogram(false)}    onSuccess={loadData} />
      <AddIatDialog          studyId={studyId} open={showAddIat}          onClose={() => setShowAddIat(false)}          onSuccess={loadData} />

      {/* Delete study confirmation */}
      {showDeleteStudyConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h2 className="font-serif text-lg text-foreground">Delete study?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete <strong>{study.title}</strong> and all its instruments, participant data, responses, scores, and clinical alerts. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteStudyConfirm(false)} disabled={deletingStudy}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={deleteStudy} disabled={deletingStudy}>
                {deletingStudy ? 'Deleting…' : 'Delete study'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add participant modal */}
      {showAddParticipant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg">Add participant</h2>
              <button onClick={() => { setShowAddParticipant(false); setManualMode('existing'); setBulkResults(null); setBulkText('') }}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex gap-2 mb-4 border-b border-border">
              <button
                onClick={() => setManualMode('existing')}
                className={`text-xs px-3 py-2 border-b-2 ${manualMode === 'existing' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground'}`}
              >Existing user</button>
              <button
                onClick={() => setManualMode('single')}
                className={`text-xs px-3 py-2 border-b-2 ${manualMode === 'single' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground'}`}
              >Create new</button>
              <button
                onClick={() => setManualMode('bulk')}
                className={`text-xs px-3 py-2 border-b-2 ${manualMode === 'bulk' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground'}`}
              >Bulk CSV</button>
            </div>

            {manualMode === 'single' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Full name"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={manualEmail}
                  onChange={e => setManualEmail(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button
                  onClick={createManualParticipant}
                  disabled={creatingManual || !manualEmail.trim() || !manualName.trim()}
                  className="w-full"
                >
                  {creatingManual ? 'Sending invite…' : 'Invite & enroll'}
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Creates a participant account and sends them an invitation email with a login link.
                </p>
              </div>
            ) : manualMode === 'bulk' ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  One participant per line as <code className="bg-muted px-1 rounded">email,full name</code>. Up to 200 rows.
                </p>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={'alice@example.com, Alice Example\nbob@example.com, Bob Example'}
                  rows={6}
                  className="w-full border border-border rounded-md px-3 py-2 text-xs font-mono bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button
                  onClick={async () => {
                    const rows = bulkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
                      const [email, ...rest] = line.split(',')
                      return { email: (email ?? '').trim(), full_name: rest.join(',').trim() }
                    }).filter(r => r.email && r.full_name)
                    if (rows.length === 0) {
                      toast.error('No valid rows', { description: 'Use format: email, full name' })
                      return
                    }
                    setBulkSubmitting(true)
                    setBulkResults(null)
                    try {
                      const res = await fetch('/api/participants/bulk-create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rows, study_id: studyId }),
                      })
                      const json = await res.json()
                      if (!res.ok) throw new Error(json.error || 'Bulk create failed')
                      setBulkResults(json.results)
                      const ok = (json.results as Array<{ ok: boolean }>).filter((r) => r.ok).length
                      toast.success(`Created ${ok} of ${rows.length} participants`)
                      await loadData()
                    } catch (err) {
                      toast.error('Bulk invite failed', { description: err instanceof Error ? err.message : 'Unknown error' })
                    } finally {
                      setBulkSubmitting(false)
                    }
                  }}
                  disabled={bulkSubmitting || !bulkText.trim()}
                  className="w-full"
                >
                  {bulkSubmitting ? 'Sending invites…' : 'Invite & enroll all'}
                </Button>
                {bulkResults && (
                  <div className="max-h-56 overflow-y-auto rounded-md border border-border text-xs">
                    {bulkResults.map((r, i) => (
                      <div key={i} className={`px-3 py-2 border-b border-border last:border-0 flex items-start justify-between gap-2 ${r.ok ? '' : 'bg-destructive/5'}`}>
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium truncate ${r.ok ? 'text-foreground' : 'text-destructive'}`}>{r.email}</p>
                          {r.ok ? (
                            <p className="text-muted-foreground text-[11px]">Invitation sent</p>
                          ) : r.error ? (
                            <p className="text-destructive/80 text-[11px]">{r.error}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            />
            {filteredProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No participants found. Make sure users have the participant role.
              </p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredProfiles.map((profile: any) => (
                  <div key={profile.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{profile.full_name}</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                    <Button size="sm" disabled={adding} onClick={() => addParticipant(profile.id)}>
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
