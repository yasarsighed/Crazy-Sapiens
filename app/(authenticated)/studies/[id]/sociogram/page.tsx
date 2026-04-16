'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Download, Share2, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Participant {
  id: string
  name: string
  category: string
  x?: number
  y?: number
}

interface Nomination {
  nominator_id: string
  nominee_id: string
  score: number
  is_negative_tie: boolean
  relationship_type: string
}

export default function SociogramPage() {
  const params = useParams()
  const studyId = params.id as string
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [study, setStudy] = useState<any>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [nominations, setNominations] = useState<Nomination[]>([])
  const [loading, setLoading] = useState(true)
  const [showRealNames, setShowRealNames] = useState(true)
  const [selectedRelationship, setSelectedRelationship] = useState('all')
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [sociogramId, setSociogramId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: studyData } = await supabase
        .from('studies')
        .select('*')
        .eq('id', studyId)
        .single()
      setStudy(studyData)

      const { data: sociogramData } = await supabase
        .from('sociogram_instruments')
        .select('*')
        .eq('study_id', studyId)
        .single()

      if (sociogramData) {
        setSociogramId(sociogramData.id)

        const { data: participantData } = await supabase
          .from('sociogram_participants')
          .select('*, profiles(full_name)')
          .eq('sociogram_id', sociogramData.id)

        const { data: nominationData } = await supabase
          .from('sociogram_nominations')
          .select('*, sociogram_relationship_types(label)')
          .eq('sociogram_id', sociogramData.id)
          .eq('is_valid', true)

        const { data: categories } = await supabase
          .from('sociogram_categories')
          .select('*')
          .eq('sociogram_id', sociogramData.id)

        const categoryColors: Record<string, string> = {}
        categories?.forEach((c: any) => {
          categoryColors[c.id] = c.color_hex || '#2D6A4F'
        })

        const mapped = (participantData || []).map((p: any, i: number) => ({
          id: p.participant_id,
          name: p.profiles?.full_name || p.anonymised_label || `P${i + 1}`,
          category: p.category_id || 'default',
          color: categoryColors[p.category_id] || '#2D6A4F',
        }))

        setParticipants(mapped)
        setNominations((nominationData || []).map((n: any) => ({
          nominator_id: n.nominator_id,
          nominee_id: n.nominee_id,
          score: n.score,
          is_negative_tie: n.is_negative_tie,
          relationship_type: n.sociogram_relationship_types?.label || 'Unknown',
        })))
      }

      setLoading(false)
    }
    load()
  }, [studyId])

  useEffect(() => {
    if (!canvasRef.current || participants.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.38

    const positioned = participants.map((p, i) => ({
      ...p,
      x: centerX + radius * Math.cos((2 * Math.PI * i) / participants.length - Math.PI / 2),
      y: centerY + radius * Math.sin((2 * Math.PI * i) / participants.length - Math.PI / 2),
    }))

    ctx.clearRect(0, 0, width, height)

    const filteredNominations = selectedRelationship === 'all'
      ? nominations
      : nominations.filter(n => n.relationship_type === selectedRelationship)

    filteredNominations.forEach(nom => {
      const from = positioned.find(p => p.id === nom.nominator_id)
      const to = positioned.find(p => p.id === nom.nominee_id)
      if (!from || !to) return

      ctx.beginPath()
      ctx.moveTo(from.x!, from.y!)
      ctx.lineTo(to.x!, to.y!)
      ctx.strokeStyle = nom.is_negative_tie
        ? `rgba(230, 57, 70, ${0.3 + nom.score * 0.1})`
        : `rgba(45, 106, 79, ${0.3 + nom.score * 0.1})`
      ctx.lineWidth = nom.score * 0.5 + 0.5
      ctx.stroke()

      const angle = Math.atan2(to.y! - from.y!, to.x! - from.x!)
      const arrowX = to.x! - 14 * Math.cos(angle)
      const arrowY = to.y! - 14 * Math.sin(angle)
      ctx.beginPath()
      ctx.moveTo(arrowX, arrowY)
      ctx.lineTo(
        arrowX - 8 * Math.cos(angle - Math.PI / 6),
        arrowY - 8 * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        arrowX - 8 * Math.cos(angle + Math.PI / 6),
        arrowY - 8 * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fillStyle = nom.is_negative_tie ? '#E63946' : '#2D6A4F'
      ctx.fill()
    })

    positioned.forEach(p => {
      const inDegree = filteredNominations.filter(n => n.nominee_id === p.id).length
      const nodeRadius = 10 + inDegree * 2

      ctx.beginPath()
      ctx.arc(p.x!, p.y!, nodeRadius, 0, Math.PI * 2)
      ctx.fillStyle = hoveredNode === p.id ? '#F4A261' : ((p as any).color || '#2D6A4F')
      ctx.fill()
      ctx.strokeStyle = '#F5F0E8'
      ctx.lineWidth = 2
      ctx.stroke()

      if (showRealNames) {
        ctx.fillStyle = '#1a1a1a'
        ctx.font = '11px Plus Jakarta Sans, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(p.name, p.x!, p.y! + nodeRadius + 14)
      }
    })
  }, [participants, nominations, showRealNames, selectedRelationship, hoveredNode])

  const relationshipTypes = ['all', ...Array.from(new Set(nominations.map(n => n.relationship_type)))]

  if (loading) return <div className="p-6 lg:p-8">Loading sociogram...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <Link href={`/studies/${studyId}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to study
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-2xl text-foreground">Sociogram</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {study?.title} — directed weighted graph of participant relationships
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Share Results
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export PNG
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-4 mb-4 bg-card">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Relationship:</span>
            <div className="flex gap-1">
              {relationshipTypes.map(rt => (
                <button
                  key={rt}
                  onClick={() => setSelectedRelationship(rt)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    selectedRelationship === rt
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {rt === 'all' ? 'All Types' : rt}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowRealNames(!showRealNames)}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              showRealNames
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            {showRealNames ? 'Hide Names' : 'Show Names'}
          </button>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-green-600"></div>
            <span className="text-xs text-muted-foreground">Positive tie</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-red-500"></div>
            <span className="text-xs text-muted-foreground">Negative tie</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-400"></div>
            <span className="text-xs text-muted-foreground">Hovered node</span>
          </div>
        </div>

        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="font-serif text-xl mb-2">No sociogram data yet.</p>
            <p className="text-sm italic text-muted-foreground">Add a sociogram instrument and collect responses first.</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full rounded-lg bg-[#F5F0E8]"
            onMouseMove={(e) => {
              const canvas = canvasRef.current
              if (!canvas) return
              const rect = canvas.getBoundingClientRect()
              const scaleX = canvas.width / rect.width
              const scaleY = canvas.height / rect.height
              const mouseX = (e.clientX - rect.left) * scaleX
              const mouseY = (e.clientY - rect.top) * scaleY
              const radius = Math.min(canvas.width, canvas.height) * 0.38
              const centerX = canvas.width / 2
              const centerY = canvas.height / 2
              const positioned = participants.map((p, i) => ({
                ...p,
                x: centerX + radius * Math.cos((2 * Math.PI * i) / participants.length - Math.PI / 2),
                y: centerY + radius * Math.sin((2 * Math.PI * i) / participants.length - Math.PI / 2),
              }))
              const found = positioned.find(p => {
                const dx = mouseX - p.x!
                const dy = mouseY - p.y!
                return Math.sqrt(dx * dx + dy * dy) < 16
              })
              setHoveredNode(found ? found.id : null)
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 text-center">
          <p className="font-serif text-2xl font-semibold text-primary">{participants.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Participants</p>
        </div>
        <div className="border rounded-xl p-4 text-center">
          <p className="font-serif text-2xl font-semibold text-primary">{nominations.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total nominations</p>
        </div>
        <div className="border rounded-xl p-4 text-center">
          <p className="font-serif text-2xl font-semibold text-primary">
            {nominations.filter(n => !n.is_negative_tie).length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Positive ties</p>
        </div>
        <div className="border rounded-xl p-4 text-center">
          <p className="font-serif text-2xl font-semibold text-primary">
            {nominations.filter(n => n.is_negative_tie).length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Negative ties</p>
        </div>
      </div>
    </div>
  )
}