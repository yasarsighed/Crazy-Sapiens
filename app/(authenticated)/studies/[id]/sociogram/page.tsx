'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Users, BarChart3 } from 'lucide-react'
import * as d3Lib from 'd3'
import type { SimulationNodeDatum } from 'd3'
import {
  reciprocity,
  clusteringCoefficient,
  connectedComponents,
  betweennessCentrality,
  closenessCentrality,
  eigenvectorCentrality,
  labelPropagationCommunities,
  modularity,
  edgeListCSV,
  nodeListCSV,
} from '@/lib/sociogram-analytics'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbParticipant {
  id: string
  participant_id: string
  display_name: string
  has_submitted: boolean
}

interface DbNomination {
  nominator_id: string
  nominee_id: string
  relationship_type_id: string
  score: number | null
}

interface DbRelType {
  id: string
  label: string
  color_hex: string | null
  is_negative_dimension: boolean
}

// Extends SimulationNodeDatum so d3 can mutate x/y/fx/fy on the same object
interface VizNode extends SimulationNodeDatum {
  id: number
  name: string
  short: string
  dept: string
  role: string
  hasSubmitted: boolean
}

type EdgeTuple = [number, number, string, number]
type EdgeCfg = Record<string, { label: string; color: string; dash: string | null; opacity: (s: number) => number }>
type DeptColors = Record<string, string>

interface NetworkMetrics {
  inDegree: number[]
  outDegree: number[]
  betweenness: number[]
  closeness: number[]
  eigenvector: number[]
  community: number[]
  reciprocity: number
  clustering: number
  components: number
  modularity: number
  density: number
  isolates: number
}

interface VizData {
  nodes: VizNode[]
  edges: EdgeTuple[]
  indegree: number[]
  edgeCfg: EdgeCfg
  deptColors: DeptColors
  relTypes: DbRelType[]
  participantCount: number
  submittedCount: number
  sociogramTitle: string
  metrics: NetworkMetrics
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_COLORS = ['#2D6A4F', '#457B9D', '#E76F51', '#E9C46A', '#6D6875', '#A8DADC']
const COMMUNITY_COLORS = ['#2D6A4F', '#457B9D', '#E76F51', '#E9C46A', '#9D4EDD', '#F4A261', '#1D3557', '#E63946', '#2A9D8F', '#B5838D']
const communityColor = (c: number) => COMMUNITY_COLORS[c % COMMUNITY_COLORS.length]

function initials(name: string) {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

// Radius scaled by in-degree
const rScale = (nodeIdx: number, indegree: number[], _nodes: VizNode[]) => {
  const min = Math.min(...indegree)
  const max = Math.max(...indegree)
  return max === min ? 22 : 16 + ((indegree[nodeIdx] - min) / (max - min)) * 16
}

// ─── Minimap ──────────────────────────────────────────────────────────────────

const MINI_W = 140
const MINI_H = 100

function drawMinimap(
  canvas: HTMLCanvasElement,
  nodes: VizNode[],
  edges: EdgeTuple[],
  edgeCfg: EdgeCfg,
  mainW: number,
  mainH: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const scaleX = MINI_W / mainW
  const scaleY = MINI_H / mainH
  ctx.clearRect(0, 0, MINI_W, MINI_H)
  ctx.fillStyle = '#F5F0E8'
  ctx.fillRect(0, 0, MINI_W, MINI_H)

  // Edges
  for (const [s, t, typeId] of edges) {
    const src = nodes[s], tgt = nodes[t]
    if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue
    const cfg = edgeCfg[typeId]
    ctx.beginPath()
    ctx.moveTo(src.x * scaleX, src.y * scaleY)
    ctx.lineTo(tgt.x * scaleX, tgt.y * scaleY)
    ctx.strokeStyle = cfg?.color ?? '#999'
    ctx.globalAlpha = 0.45
    ctx.lineWidth = 0.6
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Nodes
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (n.x == null || n.y == null) continue
    ctx.beginPath()
    ctx.arc(n.x * scaleX, n.y * scaleY, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = communityColor(0)
    ctx.fill()
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SociogramResultsPage() {
  const params = useParams()
  const studyId = params.id as string

  const svgRef       = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const minimapRef   = useRef<HTMLCanvasElement>(null)
  const simRef       = useRef<any>(null)
  const zoomRef      = useRef<any>(null)
  const svgSel       = useRef<any>(null)
  const pinnedRef    = useRef<Set<number>>(new Set())
  const dimRef       = useRef({ w: 0, h: 0 })

  const [vizData, setVizData]     = useState<VizData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [settled, setSettled]     = useState(false)
  const [focusNode, setFocusNode] = useState<number | null>(null)
  const [search, setSearch]       = useState('')
  const [showLabels, setShowLabels] = useState(true)
  const [tooltip, setTooltip]     = useState<{ x: number; y: number; id: number } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [minScore, setMinScore]   = useState(1)
  const [activeRelTypes, setActiveRelTypes] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'betweenness' | 'closeness' | 'eigenvector' | 'in' | 'out'>('betweenness')
  const [showDataIssues, setShowDataIssues] = useState(false)

  const stateRef = useRef({ focusNode, search, showLabels, activeRelTypes, minScore, vizData })
  stateRef.current = { focusNode, search, showLabels, activeRelTypes, minScore, vizData }

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()

      const { data: instruments, error: instrErr } = await supabase
        .from('sociogram_instruments')
        .select('id, title')
        .eq('study_id', studyId)
        .limit(1)

      if (instrErr || !instruments || instruments.length === 0) {
        setError('No sociogram found for this study.')
        setLoading(false)
        return
      }

      const sociogram = instruments[0]

      const [partRes, nomRes, relRes, subRes] = await Promise.all([
        supabase
          .from('sociogram_participants')
          .select('id, participant_id, display_name, has_submitted')
          .eq('sociogram_id', sociogram.id)
          .eq('is_active', true),
        supabase
          .from('sociogram_nominations')
          .select('nominator_id, nominee_id, relationship_type_id, score')
          .eq('sociogram_id', sociogram.id),
        supabase
          .from('sociogram_relationship_types')
          .select('id, label, color_hex, is_negative_dimension')
          .eq('sociogram_id', sociogram.id)
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('sociogram_participants')
          .select('id', { count: 'exact', head: false })
          .eq('sociogram_id', sociogram.id)
          .eq('has_submitted', true),
      ])

      const participants: DbParticipant[] = partRes.data ?? []
      const nominations: DbNomination[]   = nomRes.data ?? []
      const relTypes: DbRelType[]         = relRes.data ?? []
      const submittedCount                = subRes.data?.length ?? 0

      if (participants.length === 0) {
        setError('No participants have been enrolled in this sociogram yet.')
        setLoading(false)
        return
      }

      const nodeIdxById: Record<string, number> = {}
      const nodes: VizNode[] = participants.map((p, i) => {
        nodeIdxById[p.id] = i
        nodeIdxById[p.participant_id] = i
        return {
          id: i,
          name: p.display_name,
          short: initials(p.display_name),
          dept: 'Participant',
          role: p.display_name,
          hasSubmitted: p.has_submitted ?? false,
        }
      })

      const edgeCfg: EdgeCfg = {}
      const deptColors: DeptColors = { Participant: '#2D6A4F' }
      relTypes.forEach((rt, i) => {
        const color = rt.color_hex || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
        edgeCfg[rt.id] = {
          label: rt.label,
          color,
          dash: rt.is_negative_dimension ? '5 3' : null,
          opacity: rt.is_negative_dimension ? (_: number) => 0.85 : (s: number) => 0.2 + s * 0.1,
        }
      })

      const edges: EdgeTuple[] = nominations
        .filter(n => nodeIdxById[n.nominator_id] !== undefined && nodeIdxById[n.nominee_id] !== undefined)
        .map(n => [
          nodeIdxById[n.nominator_id],
          nodeIdxById[n.nominee_id],
          n.relationship_type_id,
          n.score ?? 3,
        ])

      const indegree  = nodes.map((_, i) => edges.filter(e => e[1] === i).length)
      const outdegree = nodes.map((_, i) => edges.filter(e => e[0] === i).length)
      const directedEdges: [number, number][] = edges.map(e => [e[0], e[1]])

      const betweenness = betweennessCentrality(nodes.length, directedEdges)
      const closeness   = closenessCentrality(nodes.length, directedEdges)
      const eigenvector = eigenvectorCentrality(nodes.length, directedEdges)
      const community   = labelPropagationCommunities(nodes.length, directedEdges)
      const components  = connectedComponents(nodes.length, directedEdges)
      const recip       = reciprocity(directedEdges)
      const clustering  = clusteringCoefficient(nodes.length, directedEdges)
      const mod         = modularity(nodes.length, directedEdges, community)
      const maxEdges    = nodes.length > 1 ? nodes.length * (nodes.length - 1) : 1
      const density     = edges.length / maxEdges
      const isolates    = nodes.filter((_, i) => indegree[i] === 0 && outdegree[i] === 0).length
      const numComps    = new Set(components).size

      const metrics: NetworkMetrics = {
        inDegree: indegree,
        outDegree: outdegree,
        betweenness,
        closeness,
        eigenvector,
        community,
        reciprocity: recip,
        clustering,
        components: numComps,
        modularity: mod,
        density,
        isolates,
      }

      setVizData({
        nodes, edges, indegree, edgeCfg, deptColors, relTypes,
        participantCount: participants.length,
        submittedCount,
        sociogramTitle: sociogram.title,
        metrics,
      })
      setActiveRelTypes(new Set(relTypes.map(rt => rt.id)))
      setLoading(false)
    }
    load()
  }, [studyId])

  // ── Build viz ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (vizData) buildViz(vizData)
    return () => simRef.current?.stop()
  }, [vizData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reactive filters ──────────────────────────────────────────────────────

  useEffect(() => { applyFilters() }, [focusNode, search, showLabels, activeRelTypes, minScore])

  const applyFilters = useCallback(() => {
    if (!svgSel.current) return
    const { focusNode: fn, search: sq, showLabels: sl, activeRelTypes: art, minScore: ms, vizData: vd } = stateRef.current
    if (!vd) return
    const lq = sq.toLowerCase()

    svgSel.current.selectAll('.edge').each((_: any, i: number, nodes: any[]) => {
      const sel = d3Lib.select(nodes[i])
      const d: any = sel.datum()
      const show =
        art.has(d.typeId) &&
        (d.typeId === 'communication' ? d.score >= ms : true) &&
        (fn === null || d.source.id === fn || d.target.id === fn)
      sel.attr('display', show ? null : 'none')
    })

    svgSel.current.selectAll('.node-g').each((_: any, i: number, nodes: any[]) => {
      const sel = d3Lib.select(nodes[i])
      const d: any = sel.datum()
      const nameMatch = !lq || (d.name as string).toLowerCase().includes(lq)
      const focusDim = fn !== null && d.id !== fn &&
        !vd.edges.some(e => (e[0] === fn && e[1] === d.id) || (e[1] === fn && e[0] === d.id))
      const dim = focusDim || (!!lq && !nameMatch)
      sel.attr('opacity', dim ? 0.12 : 1)
    })

    svgSel.current.selectAll('.node-label').attr('display', sl ? null : 'none')
  }, [])

  function buildViz(vd: VizData) {
    const d3 = d3Lib
    if (!svgRef.current || !containerRef.current) return

    const W = containerRef.current.clientWidth || 900
    const H = containerRef.current.clientHeight || 680
    dimRef.current = { w: W, h: H }

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H)
    svgSel.current = svg

    const defs = svg.append('defs')

    // Drop shadow filter
    const sh = defs.append('filter').attr('id', 'nshadow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%')
    sh.append('feDropShadow').attr('dx', 0).attr('dy', 2).attr('stdDeviation', 4).attr('flood-color', 'rgba(0,0,0,0.22)')

    // Text shadow filter (for labels inside nodes)
    const ts = defs.append('filter').attr('id', 'tshadow')
    ts.append('feDropShadow').attr('dx', 0).attr('dy', 0.5).attr('stdDeviation', 1.5).attr('flood-color', 'rgba(0,0,0,0.6)')

    // Arrow markers per relationship type + score
    Object.entries(vd.edgeCfg).forEach(([typeId, cfg]) => {
      [1, 2, 3, 4, 5].forEach(s => {
        defs.append('marker')
          .attr('id', `ar-${typeId.replace(/[^a-zA-Z0-9]/g, '_')}-${s}`)
          .attr('viewBox', '0 -4 8 8')
          .attr('refX', 8)
          .attr('refY', 0)
          .attr('markerWidth', 4 + s * 0.4)
          .attr('markerHeight', 4 + s * 0.4)
          .attr('orient', 'auto')
          .append('path').attr('d', 'M0,-4L8,0L0,4')
          .attr('fill', cfg.color).attr('opacity', 0.9)
      })
    })

    // Per-node radial gradients coloured by community
    vd.nodes.forEach(n => {
      const col = communityColor(vd.metrics.community[n.id] ?? 0)
      const g = defs.append('radialGradient')
        .attr('id', `gr-${n.id}`).attr('cx', '38%').attr('cy', '35%').attr('r', '65%')
      g.append('stop').attr('offset', '0%').attr('stop-color', col).attr('stop-opacity', 0.72)
      g.append('stop').attr('offset', '100%').attr('stop-color', col)
    })

    svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#F5F0E8')

    const g = svg.append('g').attr('class', 'root-g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (ev) => {
        g.attr('transform', ev.transform.toString())
        // Redraw minimap with current node positions on every user zoom/pan
        if (minimapRef.current && vd) {
          drawMinimap(minimapRef.current, vd.nodes, vd.edges, vd.edgeCfg, W, H)
        }
      })
    zoomRef.current = zoom
    svg.call(zoom)

    // Edges
    const links = vd.edges.map(([s, t, typeId, score]) => ({
      source: s, target: t, typeId, score,
      ...(vd.edgeCfg[typeId] || { label: typeId, color: '#999', dash: null, opacity: () => 0.4 }),
    }))

    // Pre-compute lateral offsets for parallel edges between same pair
    const pairCount = new Map<string, number>()
    const pairIdx   = new Map<string, number>()
    links.forEach(lk => {
      const key = `${Math.min(lk.source as number, lk.target as number)}-${Math.max(lk.source as number, lk.target as number)}`
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1)
    })
    links.forEach((lk: any) => {
      const key = `${Math.min(lk.source as number, lk.target as number)}-${Math.max(lk.source as number, lk.target as number)}`
      const count = pairCount.get(key) ?? 1
      const idx   = pairIdx.get(key) ?? 0
      lk.edgeOffset = (idx - (count - 1) / 2) * 9
      pairIdx.set(key, idx + 1)
    })

    const edgeG = g.append('g')
    const edge = edgeG.selectAll('path').data(links).join('path')
      .attr('class', 'edge')
      .attr('fill', 'none')
      .attr('stroke', (d: any) => d.color)
      .attr('stroke-width', (d: any) => Math.max(1, d.score * 0.55))
      .attr('stroke-opacity', (d: any) => (d.opacity as (s: number) => number)(d.score))
      .attr('stroke-dasharray', (d: any) => d.dash || null)
      .attr('marker-end', (d: any) => `url(#ar-${d.typeId.replace(/[^a-zA-Z0-9]/g, '_')}-${Math.max(1, Math.min(5, Math.round(d.score)))})`)

    // Nodes
    const nodeData: VizNode[] = vd.nodes.map(n => ({ ...n }))
    let clickTimer: ReturnType<typeof setTimeout> | null = null

    const nodeG = g.append('g')
    const node = nodeG.selectAll<SVGGElement, VizNode>('g').data(nodeData).join('g')
      .attr('class', 'node-g')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, VizNode>()
          .on('start', (ev, d) => {
            if (!ev.active) simRef.current?.alphaTarget(0.02).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y })
          .on('end', (ev, d) => {
            if (!ev.active) simRef.current?.alphaTarget(0)
            if (!pinnedRef.current.has(d.id)) { d.fx = null; d.fy = null }
          })
      )
      .on('click', (_ev, d) => {
        if (clickTimer) clearTimeout(clickTimer)
        clickTimer = setTimeout(() => setFocusNode((p) => p === d.id ? null : d.id), 180)
      })
      .on('dblclick', (ev, d) => {
        if (clickTimer) clearTimeout(clickTimer)
        if (pinnedRef.current.has(d.id)) {
          pinnedRef.current.delete(d.id)
          d.fx = null; d.fy = null
          d3Lib.select(ev.currentTarget).select('.pin-dot').attr('display', 'none')
        } else {
          pinnedRef.current.add(d.id)
          d.fx = d.x; d.fy = d.y
          d3Lib.select(ev.currentTarget).select('.pin-dot').attr('display', null)
        }
      })
      .on('mouseenter', (ev, d) => {
        const r = containerRef.current!.getBoundingClientRect()
        setTooltip({ x: ev.clientX - r.left + 14, y: ev.clientY - r.top - 10, id: d.id })
      })
      .on('mousemove', (ev) => {
        const r = containerRef.current!.getBoundingClientRect()
        setTooltip(p => p ? { ...p, x: ev.clientX - r.left + 14, y: ev.clientY - r.top - 10 } : null)
      })
      .on('mouseleave', () => setTooltip(null))

    // Outer glow / shadow ring
    node.append('circle')
      .attr('r', (d) => rScale(d.id, vd.indegree, vd.nodes) + 3)
      .attr('fill', '#F5F0E8').attr('stroke', 'none').attr('filter', 'url(#nshadow)')

    // Not-submitted warning ring (dashed amber, behind community ring)
    node.append('circle')
      .attr('r', (d) => rScale(d.id, vd.indegree, vd.nodes) + 5)
      .attr('fill', 'none')
      .attr('stroke', (d) => d.hasSubmitted ? 'transparent' : '#E9C46A')
      .attr('stroke-width', (d) => d.hasSubmitted ? 0 : 2)
      .attr('stroke-dasharray', '4 3')
      .attr('opacity', 0.9)
      .attr('pointer-events', 'none')

    // Community ring
    node.append('circle')
      .attr('r', (d) => rScale(d.id, vd.indegree, vd.nodes) + 2)
      .attr('fill', 'none')
      .attr('stroke', (d) => communityColor(vd.metrics.community[d.id] ?? 0))
      .attr('stroke-width', 2.5).attr('opacity', 0.7)

    // Main filled circle
    node.append('circle')
      .attr('r', (d) => rScale(d.id, vd.indegree, vd.nodes))
      .attr('fill', (d) => `url(#gr-${d.id})`)

    // Pin indicator
    node.append('circle').attr('class', 'pin-dot')
      .attr('cx', (d) => rScale(d.id, vd.indegree, vd.nodes) * 0.65)
      .attr('cy', (d) => -rScale(d.id, vd.indegree, vd.nodes) * 0.65)
      .attr('r', 3.5).attr('fill', '#F4A261').attr('stroke', 'white').attr('stroke-width', 1.2)
      .attr('display', 'none')

    // Labels INSIDE the circle — first name on top, last initial below for large nodes
    node.each((d, i, els) => {
      const sel = d3Lib.select(els[i])
      const r = rScale(d.id, vd.indegree, vd.nodes)
      const parts = d.name.trim().split(/\s+/)
      const firstName = parts[0] ?? ''
      const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] + '.' : ''

      if (r >= 28) {
        // Large node: first name + last initial on two lines
        const t = sel.append('text')
          .attr('class', 'node-label')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('pointer-events', 'none')
          .attr('filter', 'url(#tshadow)')
        t.append('tspan')
          .text(firstName.length > 8 ? firstName.slice(0, 7) + '…' : firstName)
          .attr('x', 0).attr('dy', lastInitial ? '-0.6em' : '0')
          .attr('font-size', Math.min(12, r * 0.42) + 'px').attr('font-weight', '700')
          .attr('fill', 'white').attr('font-family', 'Plus Jakarta Sans, sans-serif')
        if (lastInitial) {
          t.append('tspan')
            .text(lastInitial)
            .attr('x', 0).attr('dy', '1.25em')
            .attr('font-size', Math.min(10, r * 0.36) + 'px').attr('font-weight', '500')
            .attr('fill', 'rgba(255,255,255,0.85)').attr('font-family', 'Plus Jakarta Sans, sans-serif')
        }
      } else if (r >= 20) {
        // Medium node: first name only
        sel.append('text')
          .attr('class', 'node-label')
          .text(firstName.length > 6 ? firstName.slice(0, 5) + '…' : firstName)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('font-size', Math.min(10, r * 0.40) + 'px').attr('font-weight', '700')
          .attr('font-family', 'Plus Jakarta Sans, sans-serif')
          .attr('fill', 'white').attr('filter', 'url(#tshadow)').attr('pointer-events', 'none')
      } else {
        // Small node: initials
        sel.append('text')
          .attr('class', 'node-label')
          .text(d.short)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('font-size', Math.min(9, r * 0.42) + 'px').attr('font-weight', '800')
          .attr('font-family', 'Plus Jakarta Sans, sans-serif')
          .attr('fill', 'white').attr('filter', 'url(#tshadow)').attr('pointer-events', 'none')
      }
    })

    // Out-degree badge at the bottom of each node
    node.append('circle')
      .attr('cx', 0)
      .attr('cy', (d) => rScale(d.id, vd.indegree, vd.nodes) + 7)
      .attr('r', 7)
      .attr('fill', '#457B9D')
      .attr('stroke', '#F5F0E8')
      .attr('stroke-width', 1.5)
      .attr('opacity', (d) => (vd.metrics.outDegree[d.id] ?? 0) > 0 ? 1 : 0)

    node.append('text')
      .attr('x', 0)
      .attr('y', (d) => rScale(d.id, vd.indegree, vd.nodes) + 7)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '7px')
      .attr('font-weight', '800')
      .attr('fill', 'white')
      .attr('pointer-events', 'none')
      .text((d) => vd.metrics.outDegree[d.id] ?? 0)

    // ── Force simulation ───────────────────────────────────────────────────

    const sim = d3.forceSimulation<VizNode>(nodeData)
      .force('link', d3.forceLink<VizNode, typeof links[0]>(links).id(d => d.id).distance(100).strength(0.22))
      .force('charge', d3.forceManyBody().strength(-480))
      .force('center', d3.forceCenter(W / 2, H / 2).strength(0.04))
      .force('collision', d3.forceCollide<VizNode>().radius(d => rScale(d.id, vd.indegree, vd.nodes) + 12))
      .alphaDecay(0.035)
      .velocityDecay(0.55)

    simRef.current = sim

    let tc = 0
    sim.on('tick', () => {
      tc++; if (tc % 2 !== 0) return
      edge.attr('d', (d: any) => {
        const src = d.source, tgt = d.target
        if (!src || !tgt) return ''
        const rSrc = rScale(src.id, vd.indegree, vd.nodes)
        const rTgt = rScale(tgt.id, vd.indegree, vd.nodes)
        const sx  = (src.x ?? 0) + (d.edgeOffset ?? 0) * 0.3
        const sy  = (src.y ?? 0) + rSrc                  // bottom of source
        const ex  = (tgt.x ?? 0) + (d.edgeOffset ?? 0) * 0.3
        const ey  = (tgt.y ?? 0) - rTgt                  // top of target
        const K   = Math.max(38, Math.hypot(ex - sx, ey - sy) * 0.38)
        // Cubic bezier: exit downward from source bottom, arrive downward at target top
        return `M${sx.toFixed(1)},${sy.toFixed(1)} C${sx.toFixed(1)},${(sy + K).toFixed(1)} ${ex.toFixed(1)},${(ey - K).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`
      })
      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)

      // Update minimap every 6 ticks to keep it cheap
      if (tc % 6 === 0 && minimapRef.current) {
        drawMinimap(minimapRef.current, nodeData, vd.edges, vd.edgeCfg, W, H)
      }
    })

    sim.on('end', () => {
      nodeData.forEach(n => { n.fx = n.x; n.fy = n.y })
      sim.stop()
      setSettled(true)
      if (minimapRef.current) {
        drawMinimap(minimapRef.current, nodeData, vd.edges, vd.edgeCfg, W, H)
      }
    })

    setTimeout(applyFilters, 80)
  }

  const zoomBy = (k: number) => {
    if (!svgRef.current) return
    d3Lib.select(svgRef.current).transition().duration(300).call(
      (zoomRef.current as d3Lib.ZoomBehavior<SVGSVGElement, unknown>).scaleBy, k
    )
  }
  const zoomFit = () => {
    if (!svgRef.current) return
    d3Lib.select(svgRef.current).transition().duration(500).call(
      (zoomRef.current as d3Lib.ZoomBehavior<SVGSVGElement, unknown>).transform,
      d3Lib.zoomIdentity
    )
  }
  const exportSVG = () => {
    const svg = svgRef.current; if (!svg) return
    const s = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([s], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'sociogram.svg'; a.click()
    URL.revokeObjectURL(url)
  }
  const exportPNG = () => {
    const svg = svgRef.current; if (!svg) return
    const rect = svg.getBoundingClientRect()
    const width = Math.round(rect.width) || 1200
    const height = Math.round(rect.height) || 800
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String(height))
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const s = new XMLSerializer().serializeToString(clone)
    const svgBlob = new Blob([s], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#F5F0E8'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'sociogram.png'; a.click()
        URL.revokeObjectURL(url); URL.revokeObjectURL(svgUrl)
      }, 'image/png')
    }
    img.onerror = () => URL.revokeObjectURL(svgUrl)
    img.src = svgUrl
  }

  const toggleRelType = (id: string) => setActiveRelTypes(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  // ── Derived ────────────────────────────────────────────────────────────────

  const topNodes = vizData
    ? [...vizData.nodes].sort((a, b) => vizData.indegree[b.id] - vizData.indegree[a.id]).slice(0, 5)
    : []

  const tipNode = tooltip && vizData ? vizData.nodes[tooltip.id] : null

  const analytics = vizData ? (() => {
    const m = vizData.metrics
    const avg = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length
    return {
      n: vizData.nodes.length,
      e: vizData.edges.length,
      density: (m.density * 100).toFixed(1),
      reciprocity: (m.reciprocity * 100).toFixed(1),
      clustering: m.clustering.toFixed(3),
      modularity: m.modularity.toFixed(3),
      components: m.components,
      communities: new Set(m.community).size,
      isolates: m.isolates,
      avgIndegree: avg(m.inDegree).toFixed(2),
      avgOutdegree: avg(m.outDegree).toFixed(2),
    }
  })() : null

  const centralityRows = vizData ? [...vizData.nodes]
    .map(node => {
      const m = vizData.metrics
      return {
        node,
        inD:  m.inDegree[node.id] ?? 0,
        outD: m.outDegree[node.id] ?? 0,
        betw: m.betweenness[node.id] ?? 0,
        clos: m.closeness[node.id] ?? 0,
        eig:  m.eigenvector[node.id] ?? 0,
        community: m.community[node.id] ?? 0,
      }
    })
    .sort((a, b) => {
      const key = sortBy === 'in' ? 'inD' : sortBy === 'out' ? 'outD'
        : sortBy === 'betweenness' ? 'betw' : sortBy === 'closeness' ? 'clos' : 'eig'
      return (b as any)[key] - (a as any)[key]
    })
    .slice(0, 10)
    : []

  const noNomNodes = vizData ? vizData.nodes.filter(n => (vizData.metrics.outDegree[n.id] ?? 0) === 0) : []
  const notSubmitted = vizData ? vizData.nodes.filter(n => !n.hasSubmitted) : []

  const exportEdgeListCSV = () => {
    if (!vizData) return
    const labels = Object.fromEntries(vizData.relTypes.map(rt => [rt.id, rt.label]))
    const csv = edgeListCSV(vizData.nodes, vizData.edges, labels)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'sociogram_edges.csv'; a.click()
    URL.revokeObjectURL(url)
  }
  const exportNodeListCSV = () => {
    if (!vizData) return
    const csv = nodeListCSV(vizData.nodes, vizData.metrics)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'sociogram_nodes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F0E8]">
        <p className="text-sm text-[#8B7355]">Loading sociogram data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#F5F0E8] gap-4">
        <Users className="w-10 h-10 text-[#8B7355]" />
        <p className="font-serif text-lg text-[#3D3028]">{error}</p>
        <Link href={`/studies/${studyId}`} className="text-sm text-[#2D6A4F] hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to study
        </Link>
      </div>
    )
  }

  return (
    <div className={`flex bg-[#F5F0E8] text-[#3D3028] ${fullscreen ? 'fixed inset-0 z-50' : 'h-screen'}`}>

      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div className="w-60 flex-shrink-0 bg-white border-r border-[#E8E0D5] flex flex-col overflow-y-auto">
        <div className="px-4 py-4 border-b border-[#E8E0D5]">
          <Link href={`/studies/${studyId}`} className="flex items-center gap-1.5 text-[#8B7355] hover:text-[#2D6A4F] text-[10px] mb-2 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back to study
          </Link>
          <p className="text-[10px] font-bold text-[#2D6A4F] uppercase tracking-widest mb-0.5">Sociogram</p>
          <h1 className="text-sm font-bold text-[#3D3028]" style={{ fontFamily: 'Fraunces,serif' }}>
            {vizData?.sociogramTitle}
          </h1>
          <p className="text-[10px] text-[#8B7355] mt-0.5">
            {vizData?.participantCount} enrolled · {vizData?.submittedCount} submitted
          </p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#E8E0D5]">
          <div className="relative">
            <span className="absolute left-2.5 top-1.5 text-[#8B7355] text-xs pointer-events-none">⌕</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Find person…"
              className="w-full bg-[#F5F0E8] border border-[#DDD6CC] rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-[#3D3028] placeholder-[#B5A898] focus:outline-none focus:border-[#2D6A4F] transition-colors"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1.5 text-[#8B7355] text-[10px]">✕</button>}
          </div>
        </div>

        {/* Relationship type filters */}
        {vizData && vizData.relTypes.length > 0 && (
          <div className="px-4 py-3 border-b border-[#E8E0D5]">
            <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">Relationships</p>
            {vizData.relTypes.map(rt => {
              const cfg = vizData.edgeCfg[rt.id]
              const active = activeRelTypes.has(rt.id)
              return (
                <button
                  key={rt.id}
                  onClick={() => toggleRelType(rt.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] mb-1.5 border transition-all ${active ? 'text-[#3D3028]' : 'text-[#B5A898] border-[#E8E0D5]'}`}
                  style={active ? { backgroundColor: cfg.color + '15', borderColor: cfg.color + '55' } : {}}
                >
                  <span className="w-7 h-1.5 rounded-full flex-shrink-0" style={{ background: active ? cfg.color : '#DDD6CC' }} />
                  <span className="font-semibold">{rt.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Data quality warnings */}
        {(noNomNodes.length > 0 || notSubmitted.length > 0) && (
          <div className="px-4 py-3 border-b border-[#E8E0D5]">
            <button
              onClick={() => setShowDataIssues(p => !p)}
              className="w-full flex items-center justify-between text-[11px] font-bold text-[#E76F51] uppercase tracking-wider mb-1"
            >
              <span>⚠ Data gaps ({noNomNodes.length + notSubmitted.length})</span>
              <span>{showDataIssues ? '▲' : '▼'}</span>
            </button>
            {showDataIssues && (
              <div className="mt-1.5 space-y-1">
                {notSubmitted.map(n => (
                  <div key={n.id} className="flex items-center gap-2 text-[10px] text-[#8B7355]">
                    <span className="w-2 h-2 rounded-full border-2 border-[#E9C46A] border-dashed flex-shrink-0" />
                    <span className="truncate">{n.name}</span>
                    <span className="text-[9px] text-[#E9C46A] ml-auto">no submit</span>
                  </div>
                ))}
                {noNomNodes.filter(n => n.hasSubmitted).map(n => (
                  <div key={n.id} className="flex items-center gap-2 text-[10px] text-[#8B7355]">
                    <span className="w-2 h-2 rounded-full bg-[#E76F51] flex-shrink-0" />
                    <span className="truncate">{n.name}</span>
                    <span className="text-[9px] text-[#E76F51] ml-auto">0 sent</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Most connected */}
        {topNodes.length > 0 && (
          <div className="px-4 py-3 border-b border-[#E8E0D5]">
            <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">Most Connected</p>
            {topNodes.map((n, i) => (
              <button
                key={n.id}
                onClick={() => setFocusNode(p => p === n.id ? null : n.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] mb-1 transition-all ${focusNode === n.id ? 'bg-[#EDF7F2]' : 'hover:bg-[#FAF8F4]'}`}
              >
                <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-black text-white" style={{ background: '#2D6A4F' }}>
                  {i + 1}
                </span>
                <span className="flex-1 font-medium text-[#3D3028] truncate text-left">{n.name}</span>
                <span className="text-[11px] font-semibold text-[#2D6A4F]">{vizData?.indegree[n.id] ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        {/* View options */}
        <div className="px-4 py-3 border-b border-[#E8E0D5]">
          <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">View</p>
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <div
              onClick={() => setShowLabels(p => !p)}
              className={`w-8 h-4 rounded-full transition-colors relative ${showLabels ? 'bg-[#2D6A4F]' : 'bg-[#DDD6CC]'}`}
            >
              <span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all" style={{ left: showLabels ? 18 : 2 }} />
            </div>
            <span className="text-[11px] text-[#3D3028] font-medium">Show labels</span>
          </label>
          <p className="text-[11px] text-[#8B7355] mt-2 leading-relaxed">
            Double-click node to pin · Click to focus · Scroll to zoom
          </p>
        </div>

        {/* Network analytics */}
        {analytics && (
          <div className="px-4 py-3 border-b border-[#E8E0D5]">
            <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" /> Network analytics
            </p>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {[
                { label: 'Nodes', value: analytics.n },
                { label: 'Edges', value: analytics.e },
                { label: 'Density', value: `${analytics.density}%` },
                { label: 'Reciprocity', value: `${analytics.reciprocity}%` },
                { label: 'Clustering', value: analytics.clustering },
                { label: 'Modularity', value: analytics.modularity },
                { label: 'Communities', value: analytics.communities },
                { label: 'Components', value: analytics.components },
                { label: 'Isolates', value: analytics.isolates },
                { label: 'Avg in', value: analytics.avgIndegree },
                { label: 'Avg out', value: analytics.avgOutdegree },
              ].map(stat => (
                <div key={stat.label} className="bg-[#F5F0E8] rounded-lg p-2 text-center">
                  <p className="text-[11px] font-bold text-[#2D6A4F]">{stat.value}</p>
                  <p className="text-[8px] text-[#8B7355] uppercase tracking-wide leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-[#B5A898] leading-snug">
              Modularity &gt; 0.3 = strong community structure (Newman 2004).
            </p>
          </div>
        )}

        {/* Centrality table */}
        {vizData && centralityRows.length > 0 && (
          <div className="px-4 py-3 border-b border-[#E8E0D5]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider">Top centrality</p>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="text-[9px] bg-[#F5F0E8] border border-[#DDD6CC] rounded px-1 py-0.5 text-[#3D3028]"
              >
                <option value="betweenness">Betweenness</option>
                <option value="closeness">Closeness</option>
                <option value="eigenvector">Eigenvector</option>
                <option value="in">In-degree</option>
                <option value="out">Out-degree</option>
              </select>
            </div>
            <div className="space-y-0.5">
              {centralityRows.map(r => {
                const val = sortBy === 'in' ? r.inD : sortBy === 'out' ? r.outD
                  : sortBy === 'betweenness' ? r.betw.toFixed(3)
                  : sortBy === 'closeness' ? r.clos.toFixed(3)
                  : r.eig.toFixed(3)
                return (
                  <button
                    key={r.node.id}
                    onClick={() => setFocusNode(p => p === r.node.id ? null : r.node.id)}
                    className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-[10px] transition-all ${focusNode === r.node.id ? 'bg-[#EDF7F2]' : 'hover:bg-[#FAF8F4]'}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: communityColor(r.community) }}
                    />
                    <span className="flex-1 truncate text-left text-[#3D3028]">{r.node.name}</span>
                    <span className="font-mono font-semibold text-[#2D6A4F] tabular-nums">{val}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Export */}
        <div className="px-4 py-3 border-t border-[#E8E0D5] space-y-1.5">
          <p className="text-[11px] font-bold text-[#8B7355] uppercase tracking-wider mb-1">Export</p>
          {[
            { label: 'Edge list CSV', sub: '(Gephi / igraph)', fn: exportEdgeListCSV },
            { label: 'Node metrics CSV', sub: '(with centralities)', fn: exportNodeListCSV },
          ].map(({ label, sub, fn }) => (
            <button key={label} onClick={fn}
              className="w-full bg-[#F5F0E8] hover:bg-[#EDF7F2] border border-[#DDD6CC] rounded-lg px-2 py-1.5 text-[10px] text-[#3D3028] font-medium transition-colors text-left"
            >
              {label} <span className="text-[#8B7355] font-normal">{sub}</span>
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-[#E8E0D5]">
          <p className="text-[11px] text-[#B5A898]">
            {vizData?.submittedCount}/{vizData?.participantCount} submitted
          </p>
        </div>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" />

        {/* Top right: zoom + export controls */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="flex items-center bg-white border border-[#E8E0D5] rounded-xl shadow-sm overflow-hidden">
            <button onClick={() => zoomBy(1.35)} className="w-8 h-8 flex items-center justify-center text-[#8B7355] hover:bg-[#F5F0E8] hover:text-[#2D6A4F] transition-all text-base font-bold">+</button>
            <div className="w-px h-5 bg-[#E8E0D5]" />
            <button onClick={zoomFit} className="px-2.5 h-8 text-[11px] font-bold text-[#8B7355] hover:bg-[#F5F0E8] hover:text-[#2D6A4F] transition-all tracking-wider">FIT</button>
            <div className="w-px h-5 bg-[#E8E0D5]" />
            <button onClick={() => zoomBy(0.74)} className="w-8 h-8 flex items-center justify-center text-[#8B7355] hover:bg-[#F5F0E8] hover:text-[#2D6A4F] transition-all text-base font-bold">−</button>
          </div>
          <button onClick={exportPNG} title="Export PNG" className="w-8 h-8 bg-white border border-[#E8E0D5] rounded-xl shadow-sm text-[#8B7355] hover:text-[#2D6A4F] hover:border-[#2D6A4F]/40 transition-all flex items-center justify-center text-[10px] font-bold">PNG</button>
          <button onClick={exportSVG} title="Export SVG" className="w-8 h-8 bg-white border border-[#E8E0D5] rounded-xl shadow-sm text-[#8B7355] hover:text-[#2D6A4F] hover:border-[#2D6A4F]/40 transition-all flex items-center justify-center text-[10px] font-bold">SVG</button>
          <button onClick={() => setFullscreen(p => !p)} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} className="w-8 h-8 bg-white border border-[#E8E0D5] rounded-xl shadow-sm text-[#8B7355] hover:text-[#2D6A4F] hover:border-[#2D6A4F]/40 transition-all flex items-center justify-center text-xs">
            {fullscreen ? '⊠' : '⊡'}
          </button>
        </div>

        {/* Top left: status + focus pill */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur border border-[#E8E0D5] rounded-lg px-2.5 py-1.5 shadow-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${settled ? 'bg-[#2D6A4F]' : 'bg-[#F4A261] animate-pulse'}`} />
            <span className="text-[11px] text-[#8B7355]">{settled ? 'Layout ready' : 'Computing layout…'}</span>
          </div>
          {focusNode !== null && vizData && (
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur border border-[#2D6A4F]/30 rounded-lg px-2.5 py-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]" />
              <span className="text-[11px] font-semibold text-[#2D6A4F]">{vizData.nodes[focusNode]?.name}</span>
              <button onClick={() => setFocusNode(null)} className="text-[11px] text-[#8B7355] hover:text-[#3D3028] ml-0.5">✕</button>
            </div>
          )}
        </div>

        {/* Legend — bottom left */}
        <div className="absolute bottom-4 left-4">
          <div className="bg-white/90 backdrop-blur border border-[#E8E0D5] rounded-xl px-3 py-2.5 shadow-sm max-w-[260px]">
            <p className="text-[8px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">Legend</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>
                <p className="text-[8px] text-[#8B7355] mb-1">Node size</p>
                <div className="flex items-end gap-1">
                  {[8, 14, 20].map(s => (
                    <div key={s} className="rounded-full bg-[#2D6A4F] opacity-70" style={{ width: s/2, height: s/2 }} />
                  ))}
                  <span className="text-[9px] text-[#8B7355] ml-0.5">in-degree</span>
                </div>
              </div>
              <div>
                <p className="text-[8px] text-[#8B7355] mb-1">Node color</p>
                <div className="flex items-center gap-1">
                  {COMMUNITY_COLORS.slice(0, 4).map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                  ))}
                  <span className="text-[9px] text-[#8B7355] ml-0.5">community</span>
                </div>
              </div>
              <div>
                <p className="text-[8px] text-[#8B7355] mb-1">Bottom badge</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-[#457B9D] flex items-center justify-center">
                    <span className="text-white font-bold" style={{ fontSize: 7 }}>5</span>
                  </div>
                  <span className="text-[9px] text-[#8B7355]">out-degree (sent)</span>
                </div>
              </div>
              <div>
                <p className="text-[8px] text-[#8B7355] mb-1">Dashed ring</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full border-2 border-[#E9C46A] border-dashed" />
                  <span className="text-[9px] text-[#8B7355]">not submitted</span>
                </div>
              </div>
              <div className="col-span-2 mt-0.5">
                <p className="text-[8px] text-[#8B7355] mb-1">Arrow direction</p>
                <div className="flex items-center gap-1.5 text-[9px] text-[#8B7355]">
                  <span>↑ arrives at top</span>
                  <span className="text-[#DDD6CC]">·</span>
                  <span>exits bottom ↓</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Minimap — bottom right ───────────────────────────────────────── */}
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur border border-[#E8E0D5] rounded-xl shadow-md overflow-hidden">
          <p className="text-[8px] font-bold text-[#8B7355] uppercase tracking-wider px-2 pt-1.5 pb-0.5">Overview</p>
          <canvas
            ref={minimapRef}
            width={MINI_W}
            height={MINI_H}
            className="block"
          />
        </div>

        {/* Tooltip */}
        {tooltip && tipNode && vizData && (
          <div className="absolute z-40 pointer-events-none" style={{ left: tooltip.x, top: tooltip.y }}>
            <div className="bg-white border border-[#E8E0D5] rounded-2xl p-4 shadow-xl min-w-[180px]" style={{ borderLeftColor: communityColor(vizData.metrics.community[tipNode.id] ?? 0), borderLeftWidth: 3 }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-black text-sm"
                  style={{ background: communityColor(vizData.metrics.community[tipNode.id] ?? 0) }}
                >
                  {tipNode.short}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#3D3028]">{tipNode.name}</p>
                  <p className="text-[11px] text-[#8B7355]">Community {(vizData.metrics.community[tipNode.id] ?? 0) + 1}</p>
                </div>
              </div>
              <div className="space-y-1.5 mb-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { l: 'Received', v: vizData.indegree[tipNode.id], c: '#2D6A4F' },
                    { l: 'Sent', v: vizData.edges.filter(e => e[0] === tipNode.id).length, c: '#457B9D' },
                    { l: 'Betweenness', v: (vizData.metrics.betweenness[tipNode.id] ?? 0).toFixed(3), c: '#E76F51' },
                    { l: 'Closeness', v: (vizData.metrics.closeness[tipNode.id] ?? 0).toFixed(3), c: '#9D4EDD' },
                  ].map(s => (
                    <div key={s.l} className="bg-[#FAF8F4] rounded-lg p-2 text-center">
                      <p className="text-sm font-black" style={{ color: s.c }}>{s.v}</p>
                      <p className="text-[8px] text-[#8B7355] leading-tight mt-0.5">{s.l}</p>
                    </div>
                  ))}
                </div>
                {/* Per-type breakdown */}
                <div className="pt-1 border-t border-[#E8E0D5]">
                  {vizData.relTypes.map(rt => {
                    const cfg = vizData.edgeCfg[rt.id]
                    const sent = vizData.edges.filter(e => e[0] === tipNode.id && e[2] === rt.id).length
                    const recv = vizData.edges.filter(e => e[1] === tipNode.id && e[2] === rt.id).length
                    if (sent === 0 && recv === 0) return null
                    return (
                      <div key={rt.id} className="flex items-center gap-1.5 text-[10px] py-0.5">
                        <span className="w-2.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg?.color ?? '#999' }} />
                        <span className="flex-1 text-[#8B7355] truncate">{rt.label}</span>
                        <span className="text-[#457B9D] font-mono">↑{recv}</span>
                        <span className="text-[#2D6A4F] font-mono">↓{sent}</span>
                      </div>
                    )
                  })}
                </div>
                {!tipNode.hasSubmitted && (
                  <p className="text-[9px] text-[#E9C46A] pt-1 border-t border-[#E8E0D5]">⚠ Has not submitted nominations</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No submissions yet overlay */}
        {vizData && vizData.submittedCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#F5F0E8]/80 backdrop-blur-sm">
            <div className="text-center">
              <Users className="w-12 h-12 text-[#8B7355] mx-auto mb-3" />
              <p className="font-serif text-lg text-[#3D3028] mb-1">No submissions yet</p>
              <p className="text-sm text-[#8B7355]">
                {vizData.participantCount} participant{vizData.participantCount !== 1 ? 's' : ''} enrolled. The graph will appear once they submit.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
