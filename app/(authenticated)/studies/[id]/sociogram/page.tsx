'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Users, BarChart3, Maximize2, Minimize2, Search, X, RefreshCw } from 'lucide-react'
import * as d3Lib from 'd3'
import {
  reciprocity, clusteringCoefficient, connectedComponents,
  betweennessCentrality, closenessCentrality, eigenvectorCentrality,
  labelPropagationCommunities, modularity, edgeListCSV, nodeListCSV,
} from '@/lib/sociogram-analytics'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── Types ───────────────────────────────────────────────────────────────────
interface DbParticipant { id: string; participant_id: string; display_name: string }
interface DbNomination  { nominator_id: string; nominee_id: string; relationship_type_id: string; score: number | null }
interface DbRelType     { id: string; label: string; color_hex: string | null; is_negative_dimension: boolean }
interface VizNode       { id: number; name: string; short: string }
type EdgeTuple = [number, number, string, number]
type EdgeCfg   = Record<string, { label: string; color: string; dash: string | null }>
interface NetworkMetrics {
  inDegree: number[]; outDegree: number[]; betweenness: number[]
  closeness: number[]; eigenvector: number[]; community: number[]
  reciprocity: number; clustering: number; components: number
  modularity: number; density: number; isolates: number
}
interface VizData {
  nodes: VizNode[]; edges: EdgeTuple[]; indegree: number[]
  edgeCfg: EdgeCfg; relTypes: DbRelType[]; participantCount: number
  submittedCount: number; sociogramTitle: string; metrics: NetworkMetrics
}

// ─── Constants ───────────────────────────────────────────────────────────────
const COMMUNITY_PALETTE = [
  '#CE2029','#4A7A40','#D06828','#6845A5',
  '#D06828','#6845A5','#7A1010','#4A7A40',
  '#CE2029','#4A7A40',
]
const communityColor = (c: number) => COMMUNITY_PALETTE[c % COMMUNITY_PALETTE.length]

function initials(name: string) {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}
const rScale = (idx: number, indegree: number[]) => {
  const min = Math.min(...indegree), max = Math.max(...indegree)
  return max === min ? 14 : 10 + ((indegree[idx] - min) / (max - min)) * 16
}

// ── Curved arc path ───────────────────────────────────────────────────────────
function arcPath(sx: number, sy: number, tx: number, ty: number, bidirectional: boolean) {
  const dx = tx - sx, dy = ty - sy
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const curvature = 0.22
  const mx = (sx + tx) / 2 + (bidirectional ? 1 : -1) * curvature * dy
  const my = (sy + ty) / 2 - (bidirectional ? 1 : -1) * curvature * dx
  const pad = 18
  const sx2 = sx + (dx / len) * pad, sy2 = sy + (dy / len) * pad
  const tx2 = tx - (dx / len) * pad, ty2 = ty - (dy / len) * pad
  return `M${sx2},${sy2} Q${mx},${my} ${tx2},${ty2}`
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SociogramResultsPage() {
  const params  = useParams()
  const studyId = params.id as string

  const svgRef       = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef       = useRef<any>(null)
  const zoomRef      = useRef<any>(null)
  const svgSel       = useRef<any>(null)
  const pinnedRef    = useRef<Set<number>>(new Set())

  const [vizData, setVizData]       = useState<VizData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [settled, setSettled]       = useState(false)
  const [focusNode, setFocusNode]   = useState<number | null>(null)
  const [search, setSearch]         = useState('')
  const [showLabels, setShowLabels] = useState(true)
  const [tooltip, setTooltip]       = useState<{ x: number; y: number; id: number } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [minScore, setMinScore]     = useState(1)
  const [activeRelTypes, setActiveRelTypes] = useState<Set<string>>(new Set())
  const [showRecipOnly, setShowRecipOnly]   = useState(false)
  const [sortBy, setSortBy] = useState<'betweenness' | 'closeness' | 'eigenvector' | 'in' | 'out'>('betweenness')

  const stateRef = useRef({ focusNode, search, showLabels, activeRelTypes, minScore, showRecipOnly, vizData })
  stateRef.current = { focusNode, search, showLabels, activeRelTypes, minScore, showRecipOnly, vizData }

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true); setSettled(false)
      const supabase = createClient()
      const { data: instruments } = await supabase
        .from('sociogram_instruments').select('id, title').eq('study_id', studyId).limit(1)
      if (!instruments?.length) { setError('No sociogram found for this study.'); setLoading(false); return }
      const sociogram = instruments[0]

      const [partRes, nomRes, relRes, subRes] = await Promise.all([
        supabase.from('sociogram_participants').select('id, participant_id, display_name').eq('sociogram_id', sociogram.id).eq('is_active', true),
        supabase.from('sociogram_nominations').select('nominator_id, nominee_id, relationship_type_id, score').eq('sociogram_id', sociogram.id),
        supabase.from('sociogram_relationship_types').select('id, label, color_hex, is_negative_dimension').eq('sociogram_id', sociogram.id).eq('is_active', true).order('display_order'),
        supabase.from('sociogram_participants').select('id', { count: 'exact', head: false }).eq('sociogram_id', sociogram.id).eq('has_submitted', true),
      ])

      const participants: DbParticipant[] = partRes.data ?? []
      const nominations: DbNomination[]   = nomRes.data  ?? []
      const relTypes: DbRelType[]         = relRes.data  ?? []
      const submittedCount                = subRes.data?.length ?? 0

      if (!participants.length) { setError('No participants enrolled yet.'); setLoading(false); return }

      const nodeIdxById: Record<string, number> = {}
      const nodes: VizNode[] = participants.map((p, i) => {
        nodeIdxById[p.id] = i; nodeIdxById[p.participant_id] = i
        return { id: i, name: p.display_name, short: initials(p.display_name) }
      })

      const edgeCfg: EdgeCfg = {}
      relTypes.forEach((rt, i) => {
        edgeCfg[rt.id] = { label: rt.label, color: rt.color_hex || COMMUNITY_PALETTE[i % COMMUNITY_PALETTE.length], dash: rt.is_negative_dimension ? '6 3' : null }
      })

      const edges: EdgeTuple[] = nominations
        .filter(n => nodeIdxById[n.nominator_id] !== undefined && nodeIdxById[n.nominee_id] !== undefined)
        .map(n => [nodeIdxById[n.nominator_id], nodeIdxById[n.nominee_id], n.relationship_type_id, n.score ?? 3])

      const indegree  = nodes.map((_, i) => edges.filter(e => e[1] === i).length)
      const dirEdges: [number,number][] = edges.map(e => [e[0], e[1]])

      const betweenness = betweennessCentrality(nodes.length, dirEdges)
      const closeness   = closenessCentrality(nodes.length, dirEdges)
      const eigenvector = eigenvectorCentrality(nodes.length, dirEdges)
      const community   = labelPropagationCommunities(nodes.length, dirEdges)
      const components  = connectedComponents(nodes.length, dirEdges)
      const recip       = reciprocity(dirEdges)
      const clustering  = clusteringCoefficient(nodes.length, dirEdges)
      const mod         = modularity(nodes.length, dirEdges, community)
      const maxEdges    = nodes.length > 1 ? nodes.length * (nodes.length - 1) : 1

      setVizData({
        nodes, edges, indegree, edgeCfg, relTypes,
        participantCount: participants.length, submittedCount,
        sociogramTitle: sociogram.title,
        metrics: {
          inDegree: indegree, outDegree: nodes.map((_, i) => edges.filter(e => e[0] === i).length),
          betweenness, closeness, eigenvector, community,
          reciprocity: recip, clustering, components: new Set(components).size,
          modularity: mod, density: edges.length / maxEdges,
          isolates: nodes.filter((_, i) => indegree[i] === 0 && edges.filter(e => e[0] === i).length === 0).length,
        },
      })
      setActiveRelTypes(new Set(relTypes.map(rt => rt.id)))
      setLoading(false)
    }
    load()
  }, [studyId])

  useEffect(() => {
    if (vizData) buildViz(vizData)
    return () => simRef.current?.stop()
  }, [vizData])

  useEffect(() => { applyFilters() }, [focusNode, search, showLabels, activeRelTypes, minScore, showRecipOnly])

  const applyFilters = useCallback(() => {
    if (!svgSel.current) return
    const { focusNode: fn, search: sq, showLabels: sl, activeRelTypes: art, minScore: ms, showRecipOnly: rOnly, vizData: vd } = stateRef.current
    if (!vd) return
    const lq = sq.toLowerCase()
    const edgeSet = new Set(vd.edges.map(([a, b]) => `${a}|${b}`))
    const isRecip  = (a: number, b: number) => edgeSet.has(`${b}|${a}`)

    svgSel.current.selectAll('.edge-path').each(function (d: any) {
      const sa = d.source.id ?? d.source, ta = d.target.id ?? d.target
      const show = art.has(d.typeId) && d.score >= ms && (!rOnly || isRecip(sa, ta)) && (fn === null || sa === fn || ta === fn)
      d3Lib.select(this).style('opacity', show ? 0.8 : 0).style('pointer-events', show ? null : 'none')
    })

    svgSel.current.selectAll('.node-g').each(function (d: any) {
      const nameMatch = !lq || (d.name as string).toLowerCase().includes(lq)
      const focusDim  = fn !== null && d.id !== fn && !vd.edges.some(e => (e[0] === fn && e[1] === d.id) || (e[1] === fn && e[0] === d.id))
      d3Lib.select(this).style('opacity', (focusDim || (!!lq && !nameMatch)) ? 0.06 : 1)
    })

    svgSel.current.selectAll('.node-label').style('display', sl ? null : 'none')
  }, [])

  function buildViz(vd: VizData) {
    const d3 = d3Lib
    if (!svgRef.current || !containerRef.current) return
    pinnedRef.current.clear()

    const W = containerRef.current.clientWidth || 900
    const H = containerRef.current.clientHeight || 680

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H)
    svgSel.current = svg

    // Defs
    const defs = svg.append('defs')

    const sh = defs.append('filter').attr('id', 'node-shadow').attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%')
    sh.append('feDropShadow').attr('dx', 0).attr('dy', 2).attr('stdDeviation', 4).attr('flood-color', 'rgba(0,0,0,0.14)')

    // Arrow markers
    Object.entries(vd.edgeCfg).forEach(([typeId, cfg]) => {
      const sid = typeId.replace(/[^a-zA-Z0-9]/g, '_')
      ;[1,2,3,4,5].forEach(s => {
        defs.append('marker')
          .attr('id', `ar-${sid}-${s}`).attr('viewBox', '0 -5 10 10').attr('refX', 2).attr('refY', 0)
          .attr('markerWidth', 4 + s * 0.4).attr('markerHeight', 4 + s * 0.4).attr('orient', 'auto')
          .append('path').attr('d', 'M0,-5L10,0L0,5Z').attr('fill', cfg.color).attr('opacity', 0.9)
      })
    })

    // Node radial gradients
    vd.nodes.forEach(n => {
      const col = communityColor(vd.metrics.community[n.id] ?? 0)
      const g = defs.append('radialGradient').attr('id', `ng-${n.id}`).attr('cx', '35%').attr('cy', '30%').attr('r', '70%')
      g.append('stop').attr('offset', '0%').attr('stop-color', '#FFF').attr('stop-opacity', 0.95)
      g.append('stop').attr('offset', '45%').attr('stop-color', col).attr('stop-opacity', 0.85)
      g.append('stop').attr('offset', '100%').attr('stop-color', col)
    })

    svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'var(--background, #FAFAF8)')

    const g = svg.append('g').attr('class', 'root-g')
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.05, 6]).on('zoom', (ev: any) => g.attr('transform', ev.transform))
    zoomRef.current = zoom
    svg.call(zoom as any)

    // Edges
    const edgeSet = new Set(vd.edges.map(([a, b]) => `${a}|${b}`))
    const links = vd.edges.map(([s, t, typeId, score]) => ({
      source: s, target: t, typeId, score,
      ...(vd.edgeCfg[typeId] || { label: typeId, color: '#9B9BAB', dash: null }),
    }))

    const edgePaths = g.append('g').selectAll('path').data(links).join('path')
      .attr('class', 'edge-path')
      .attr('fill', 'none')
      .attr('stroke', (d: any) => d.color)
      .attr('stroke-width', (d: any) => 0.8 + d.score * 0.55)
      .attr('stroke-dasharray', (d: any) => d.dash || null)
      .attr('marker-end', (d: any) => {
        const sid = d.typeId.replace(/[^a-zA-Z0-9]/g, '_')
        return `url(#ar-${sid}-${Math.max(1, Math.min(5, Math.round(d.score)))})`
      })
      .style('transition', 'opacity 0.15s ease')

    // Nodes
    const nodeData = vd.nodes.map(n => ({ ...n }))
    let clickTimer: any = null

    const node = g.append('g').selectAll('g').data(nodeData).join('g')
      .attr('class', 'node-g').style('cursor', 'pointer')
      .call(
        d3.drag<any, any>()
          .on('start', (ev: any, d: any) => { if (!ev.active) simRef.current?.alphaTarget(0.03).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag',  (ev: any, d: any) => { d.fx = ev.x; d.fy = ev.y })
          .on('end',   (ev: any, d: any) => {
            if (!ev.active) simRef.current?.alphaTarget(0)
            if (!pinnedRef.current.has(d.id)) { d.fx = null; d.fy = null }
          })
      )
      .on('click', (_ev: any, d: any) => { clearTimeout(clickTimer); clickTimer = setTimeout(() => setFocusNode((p: any) => p === d.id ? null : d.id), 180) })
      .on('dblclick', (_ev: any, d: any) => {
        clearTimeout(clickTimer)
        if (pinnedRef.current.has(d.id)) {
          pinnedRef.current.delete(d.id); d.fx = null; d.fy = null
          d3Lib.select(_ev.currentTarget).select('.pin-ring').attr('display', 'none')
        } else {
          pinnedRef.current.add(d.id); d.fx = d.x; d.fy = d.y
          d3Lib.select(_ev.currentTarget).select('.pin-ring').attr('display', null)
        }
      })
      .on('mouseenter', (ev: any, d: any) => {
        const r = containerRef.current!.getBoundingClientRect()
        setTooltip({ x: ev.clientX - r.left + 16, y: ev.clientY - r.top - 12, id: d.id })
      })
      .on('mousemove', (ev: any) => {
        const r = containerRef.current!.getBoundingClientRect()
        setTooltip(p => p ? { ...p, x: ev.clientX - r.left + 16, y: ev.clientY - r.top - 12 } : null)
      })
      .on('mouseleave', () => setTooltip(null))

    // Community glow ring
    node.append('circle').attr('r', (d: any) => rScale(d.id, vd.indegree) + 4).attr('fill', 'none')
      .attr('stroke', (d: any) => communityColor(vd.metrics.community[d.id] ?? 0)).attr('stroke-width', 2.5).attr('stroke-opacity', 0.3)

    // Shadow backing
    node.append('circle').attr('r', (d: any) => rScale(d.id, vd.indegree) + 1).attr('fill', 'var(--card, #FFF)').attr('filter', 'url(#node-shadow)')

    // Gradient fill
    node.append('circle').attr('r', (d: any) => rScale(d.id, vd.indegree)).attr('fill', (d: any) => `url(#ng-${d.id})`)

    // Highlight circle
    node.each(function (d: any) {
      const r = rScale(d.id, vd.indegree)
      d3Lib.select(this).append('circle').attr('cx', -r*0.22).attr('cy', -r*0.22).attr('r', r*0.28).attr('fill', 'rgba(255,255,255,0.5)').attr('stroke', 'none')
    })

    // Pin ring
    node.append('circle').attr('class', 'pin-ring')
      .attr('r', (d: any) => rScale(d.id, vd.indegree) + 2.5).attr('fill', 'none')
      .attr('stroke', '#F97316').attr('stroke-width', 2).attr('stroke-dasharray', '3 2').attr('display', 'none')

    // Initials
    node.append('text').text((d: any) => d.short)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', (d: any) => Math.max(9, rScale(d.id, vd.indegree) * 0.62))
      .attr('font-weight', '800').attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .attr('fill', 'white').attr('pointer-events', 'none')

    // Name label
    node.append('text').attr('class', 'node-label')
      .text((d: any) => {
        const r = rScale(d.id, vd.indegree); const parts = d.name.split(' ')
        return r >= 22 ? parts.slice(0,2).join(' ') : parts[0]
      })
      .attr('text-anchor', 'middle').attr('y', (d: any) => rScale(d.id, vd.indegree) + 14)
      .attr('font-size', '11px').attr('font-weight', '600').attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .attr('fill', 'var(--foreground, #241F1C)')
      .attr('stroke', 'var(--background, #FAFAF8)').attr('stroke-width', 3).attr('paint-order', 'stroke')
      .attr('pointer-events', 'none')

    // Simulation
    const sim = d3.forceSimulation(nodeData as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100).strength(0.2))
      .force('charge', d3.forceManyBody().strength(-480).distanceMax(400))
      .force('center', d3.forceCenter(W/2, H/2).strength(0.05))
      .force('collision', d3.forceCollide().radius((d: any) => rScale(d.id, vd.indegree) + 14))
      .alphaDecay(0.035).velocityDecay(0.5)
    simRef.current = sim

    let tc = 0
    sim.on('tick', () => {
      tc++; if (tc % 2 !== 0) return
      edgePaths.attr('d', (d: any) => {
        const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y
        if (sx === undefined || tx === undefined) return ''
        const hasPair = edgeSet.has(`${d.target.id ?? d.target}|${d.source.id ?? d.source}`)
        return arcPath(sx, sy, tx, ty, hasPair)
      })
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    sim.on('end', () => {
      nodeData.forEach((n: any) => { n.fx = n.x; n.fy = n.y })
      sim.stop(); setSettled(true)
    })

    setTimeout(applyFilters, 100)
  }

  const resetLayout = () => {
    if (!vizData) return; setSettled(false); pinnedRef.current.clear()
    const nd = (simRef.current?.nodes() ?? []) as any[]
    nd.forEach((n: any) => { n.fx = null; n.fy = null })
    simRef.current?.alpha(0.5).alphaDecay(0.035).restart()
  }

  const zoomBy = (k: number) => { if (!svgRef.current) return; d3Lib.select(svgRef.current).transition().duration(280).call((zoomRef.current as any).scaleBy, k) }
  const zoomFit = () => { if (!svgRef.current) return; d3Lib.select(svgRef.current).transition().duration(480).call((zoomRef.current as any).transform, d3Lib.zoomIdentity) }

  const exportSVG = () => {
    const svg = svgRef.current; if (!svg) return
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })), download: 'sociogram.svg' }); a.click()
  }
  const exportPNG = () => {
    const svg = svgRef.current; if (!svg) return
    const { width: W, height: H } = svg.getBoundingClientRect(); const scale = 2
    const canvas = Object.assign(document.createElement('canvas'), { width: W*scale, height: H*scale })
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#FAFAF8'; ctx.fillRect(0,0,canvas.width,canvas.height)
    const img = new Image()
    img.onload = () => { ctx.scale(scale,scale); ctx.drawImage(img,0,0,W,H); canvas.toBlob(b => { if(!b)return; const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(b),download:'sociogram.png'}); a.click() },'image/png') }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
  }
  const exportEdges = () => { if (!vizData) return; const labels = Object.fromEntries(vizData.relTypes.map(rt => [rt.id, rt.label])); const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([edgeListCSV(vizData.nodes, vizData.edges, labels)],{type:'text/csv'})),download:'sociogram_edges.csv'}); a.click() }
  const exportNodes = () => { if (!vizData) return; const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([nodeListCSV(vizData.nodes, vizData.metrics)],{type:'text/csv'})),download:'sociogram_nodes.csv'}); a.click() }
  const toggleRelType = (id: string) => setActiveRelTypes(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── Derived ───────────────────────────────────────────────────────────────
  const topNodes = vizData ? [...vizData.nodes].sort((a,b) => vizData.indegree[b.id]-vizData.indegree[a.id]).slice(0,6) : []
  const tipNode  = tooltip && vizData ? vizData.nodes[tooltip.id] : null
  const relNomCounts = vizData ? vizData.relTypes.map(rt => ({ rt, count: vizData.edges.filter(e => e[2]===rt.id).length })) : []

  const analytics = vizData ? (() => {
    const m = vizData.metrics; const avg = (a: number[]) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0
    return {
      n: vizData.nodes.length, e: vizData.edges.length,
      density: (m.density*100).toFixed(1), reciprocity: (m.reciprocity*100).toFixed(1),
      clustering: m.clustering.toFixed(3), modularity: m.modularity.toFixed(3),
      components: m.components, communities: new Set(m.community).size, isolates: m.isolates,
      avgIn: avg(m.inDegree).toFixed(2), avgOut: avg(m.outDegree).toFixed(2),
    }
  })() : null

  const centralityRows = vizData
    ? [...vizData.nodes].map(n => ({
        node: n, inD: vizData.metrics.inDegree[n.id]??0, outD: vizData.metrics.outDegree[n.id]??0,
        betw: vizData.metrics.betweenness[n.id]??0, clos: vizData.metrics.closeness[n.id]??0,
        eig: vizData.metrics.eigenvector[n.id]??0, comm: vizData.metrics.community[n.id]??0,
      }))
      .sort((a,b) => {
        const k = sortBy==='in'?'inD':sortBy==='out'?'outD':sortBy==='betweenness'?'betw':sortBy==='closeness'?'clos':'eig'
        return (b as any)[k]-(a as any)[k]
      })
    : []

  const maxFor = (k: 'betw'|'clos'|'eig'|'inD'|'outD') => Math.max(...centralityRows.map(r=>r[k] as number), 0.0001)

  const communities = vizData ? (() => {
    const map: Record<number, VizNode[]> = {}
    vizData.nodes.forEach(n => { const c = vizData.metrics.community[n.id]??0; (map[c]??=[]).push(n) })
    return Object.entries(map).map(([c,nodes])=>({id:Number(c),nodes})).sort((a,b)=>b.nodes.length-a.nodes.length)
  })() : []

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Building sociogram…</p>
      </div>
    </div>
  )
  if (error) return (
    <div className="flex flex-col h-screen items-center justify-center bg-background gap-4">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center"><Users className="w-7 h-7 text-muted-foreground/60" /></div>
      <p className="font-serif text-lg text-foreground">{error}</p>
      <Link href={`/studies/${studyId}`} className="text-sm text-primary hover:underline flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Back to study</Link>
    </div>
  )

  return (
    <div className={`flex bg-background text-foreground ${fullscreen ? 'fixed inset-0 z-50' : 'h-screen'}`}>

      {/* ══ LEFT PANEL ══ */}
      <div className="w-64 flex-shrink-0 bg-card border-r border-border flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0"
          style={{ background: 'var(--primary)' }}>
          <Link href={`/studies/${studyId}`} className="flex items-center gap-1 text-white/60 hover:text-white text-[10px] mb-2 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back to study
          </Link>
          <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-0.5">Sociogram</p>
          <h1 className="text-[13px] font-bold text-white leading-tight" style={{ fontFamily: 'Fraunces,serif' }}>{vizData?.sociogramTitle}</h1>
          <p className="text-[10px] text-white/60 mt-1">{vizData?.participantCount} enrolled · {vizData?.submittedCount} submitted</p>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search participant…"
              className="w-full bg-muted/50 border border-border rounded-xl pl-7 pr-7 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-all" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="controls" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="mx-3 mt-2 mb-1 shrink-0 h-7">
            <TabsTrigger value="controls" className="flex-1 text-[10px] h-6">Controls</TabsTrigger>
            <TabsTrigger value="analysis" className="flex-1 text-[10px] h-6">Analysis</TabsTrigger>
          </TabsList>

          {/* Controls */}
          <TabsContent value="controls" className="flex-1 overflow-y-auto m-0 p-0">

            {/* Relationship filters */}
            {vizData && vizData.relTypes.length > 0 && (
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Relationships</p>
                <div className="space-y-1">
                  {vizData.relTypes.map(rt => {
                    const cfg = vizData.edgeCfg[rt.id]; const active = activeRelTypes.has(rt.id)
                    const count = relNomCounts.find(r => r.rt.id === rt.id)?.count ?? 0
                    return (
                      <button key={rt.id} onClick={() => toggleRelType(rt.id)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-all border"
                        style={active
                          ? { backgroundColor: cfg.color+'18', borderColor: cfg.color+'55', color: 'var(--foreground)' }
                          : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
                        }>
                        <span className="w-6 h-1.5 rounded-full shrink-0" style={{ background: active ? cfg.color : 'var(--muted)' }} />
                        <span className="flex-1 font-semibold text-left truncate">{rt.label}</span>
                        <span className="text-[10px] font-mono opacity-60 shrink-0">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Score filter */}
            <div className="px-3 py-2.5 border-b border-border">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Min Tie Strength</p>
                <span className="text-[12px] font-bold text-primary">{minScore}</span>
              </div>
              <input type="range" min={1} max={5} step={1} value={minScore} onChange={e => setMinScore(Number(e.target.value))}
                className="w-full h-1.5 rounded-full cursor-pointer accent-primary" />
              <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-1"><span>1 (weak)</span><span>5 (strong)</span></div>
            </div>

            {/* Toggles */}
            <div className="px-3 py-2.5 border-b border-border space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">View</p>
              {[
                { label: 'Show name labels', state: showLabels, toggle: () => setShowLabels(p => !p) },
                { label: 'Reciprocal ties only', state: showRecipOnly, toggle: () => setShowRecipOnly(p => !p) },
              ].map(opt => (
                <label key={opt.label} className="flex items-center gap-2 cursor-pointer select-none">
                  <button onClick={opt.toggle}
                    className="w-8 h-4 rounded-full relative shrink-0 focus:outline-none"
                    style={{ background: opt.state ? 'var(--primary)' : 'var(--muted)' }}>
                    <span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all" style={{ left: opt.state ? 18 : 2 }} />
                  </button>
                  <span className="text-[11px] text-foreground font-medium">{opt.label}</span>
                </label>
              ))}
              <p className="text-[10px] text-muted-foreground/60">Double-click node to pin · Click to focus</p>
            </div>

            {/* Most nominated */}
            {topNodes.length > 0 && (
              <div className="px-3 py-2.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Most Nominated</p>
                <div className="space-y-1">
                  {topNodes.map((n, i) => (
                    <button key={n.id} onClick={() => setFocusNode(p => p === n.id ? null : n.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-all hover:bg-muted/60"
                      style={focusNode === n.id ? { background: 'color-mix(in srgb, var(--primary) 10%, var(--background))' } : {}}>
                      <span className="w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black text-white shrink-0"
                        style={{ background: communityColor(vizData?.metrics.community[n.id] ?? 0) }}>{i+1}</span>
                      <span className="flex-1 text-[11px] font-medium text-foreground truncate text-left">{n.name}</span>
                      <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: communityColor(vizData?.metrics.community[n.id]??0) }}>
                        {vizData?.indegree[n.id]??0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Analysis */}
          <TabsContent value="analysis" className="flex-1 overflow-y-auto m-0 p-0">

            {/* Network metrics */}
            {analytics && (
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> Network Metrics
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { l:'Nodes',      v:analytics.n,           c:'#CE2029' },
                    { l:'Edges',       v:analytics.e,           c:'#6845A5' },
                    { l:'Density',     v:`${analytics.density}%`, c:'#D06828' },
                    { l:'Reciprocity', v:`${analytics.reciprocity}%`, c:'#4A7A40' },
                    { l:'Clustering',  v:analytics.clustering,  c:'#D06828' },
                    { l:'Modularity',  v:analytics.modularity,  c:'#6845A5' },
                    { l:'Communities', v:analytics.communities, c:'#7A1010' },
                    { l:'Components',  v:analytics.components,  c:'#4A7A40' },
                    { l:'Isolates',    v:analytics.isolates,    c:analytics.isolates>0?'#CE2029':'#7A7268' },
                    { l:'Avg in',      v:analytics.avgIn,       c:'#6845A5' },
                    { l:'Avg out',     v:analytics.avgOut,      c:'#D06828' },
                  ].map(s => (
                    <div key={s.l} className="bg-muted/50 rounded-xl p-2 text-center">
                      <p className="text-[13px] font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-wide leading-tight mt-0.5">{s.l}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground/70 mt-2 leading-snug">Modularity &gt; 0.3 = strong structure. Reciprocity = mutual/total ties.</p>
              </div>
            )}

            {/* Centrality with mini bars */}
            {centralityRows.length > 0 && (
              <div className="px-3 py-2.5 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Top Centrality</p>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                    className="text-[9px] bg-muted border border-border rounded-lg px-1.5 py-0.5 text-foreground focus:outline-none">
                    <option value="betweenness">Betweenness</option>
                    <option value="closeness">Closeness</option>
                    <option value="eigenvector">Eigenvector</option>
                    <option value="in">In-degree</option>
                    <option value="out">Out-degree</option>
                  </select>
                </div>
                <div className="space-y-0.5">
                  {centralityRows.slice(0, 12).map(r => {
                    const rv = sortBy==='in'?r.inD:sortBy==='out'?r.outD:sortBy==='betweenness'?r.betw:sortBy==='closeness'?r.clos:r.eig
                    const dv = typeof rv==='number'&&!Number.isInteger(rv)?rv.toFixed(3):String(rv)
                    const mk = sortBy==='in'?'inD':sortBy==='out'?'outD':sortBy==='betweenness'?'betw':sortBy==='closeness'?'clos':'eig'
                    const bp = maxFor(mk as any)>0?(rv as number)/maxFor(mk as any)*100:0
                    const col = communityColor(r.comm)
                    return (
                      <button key={r.node.id} onClick={() => setFocusNode(p => p===r.node.id?null:r.node.id)}
                        className="w-full flex flex-col px-2 py-1.5 rounded-xl transition-all hover:bg-muted/50 gap-0.5"
                        style={focusNode===r.node.id?{background:`color-mix(in srgb, ${col} 12%, var(--background))`}:{}}>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                          <span className="flex-1 text-[10px] font-semibold text-foreground truncate text-left">{r.node.name}</span>
                          <span className="text-[10px] font-mono font-bold shrink-0" style={{ color: col }}>{dv}</span>
                        </div>
                        <div className="h-1 bg-muted/60 rounded-full overflow-hidden ml-3.5">
                          <div className="h-full rounded-full" style={{ width:`${Math.max(2,bp)}%`, background:col, opacity:0.65 }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Community legend */}
            {communities.length > 1 && (
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Communities</p>
                <div className="space-y-1.5">
                  {communities.slice(0,8).map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-md shrink-0" style={{ background: communityColor(c.id) }} />
                      <span className="text-[11px] text-foreground font-medium flex-1">Group {c.id+1}</span>
                      <span className="text-[10px] text-muted-foreground">{c.nodes.length} members</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground/70 mt-2">Label propagation (undirected).</p>
              </div>
            )}

            {/* Export */}
            <div className="px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Export</p>
              {[
                { l: 'Edge list CSV', s: 'Gephi / igraph', fn: exportEdges },
                { l: 'Node metrics CSV', s: 'All centrality scores', fn: exportNodes },
              ].map(b => (
                <button key={b.l} onClick={b.fn}
                  className="w-full text-left px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 transition-colors">
                  <p className="text-[11px] font-semibold text-foreground">{b.l}</p>
                  <p className="text-[9px] text-muted-foreground">{b.s}</p>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ══ CANVAS ══ */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" style={{ display:'block' }} />

        {/* Status */}
        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-card/90 backdrop-blur-md border border-border rounded-xl px-3 py-1.5 shadow-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${settled?'':'animate-pulse'}`} style={{ background: settled ? '#4A7A40' : '#D06828' }} />
            <span className="text-[11px] font-medium text-muted-foreground">{settled?'Layout ready':'Computing…'}</span>
          </div>
          {focusNode !== null && vizData && (
            <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md border border-primary/30 rounded-xl px-3 py-1.5 shadow-sm pointer-events-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[11px] font-semibold text-primary">{vizData.nodes[focusNode]?.name}</span>
              <button onClick={() => setFocusNode(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="flex items-center bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-sm overflow-hidden">
            <button onClick={() => zoomBy(1.4)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all font-bold text-base">+</button>
            <div className="w-px h-5 bg-border" />
            <button onClick={zoomFit} className="px-2.5 h-8 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all tracking-widest">FIT</button>
            <div className="w-px h-5 bg-border" />
            <button onClick={() => zoomBy(0.7)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all font-bold text-base">−</button>
          </div>
          <button onClick={resetLayout} title="Restart layout" className="w-8 h-8 bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-sm text-muted-foreground hover:text-foreground flex items-center justify-center transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={exportPNG} className="h-8 px-2.5 bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-sm text-muted-foreground hover:text-foreground text-[10px] font-bold transition-all">PNG</button>
          <button onClick={exportSVG} className="h-8 px-2.5 bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-sm text-muted-foreground hover:text-foreground text-[10px] font-bold transition-all">SVG</button>
          <button onClick={() => setFullscreen(p => !p)} title={fullscreen?'Exit fullscreen':'Fullscreen'}
            className="w-8 h-8 bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-sm text-muted-foreground hover:text-foreground flex items-center justify-center transition-all">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 pointer-events-none">
          <div className="bg-card/85 backdrop-blur-md border border-border rounded-2xl px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Node size = in-degree</p>
                <div className="flex items-center gap-1.5">
                  {[8,12,18,24].map(s => <div key={s} className="rounded-full" style={{width:s*0.5,height:s*0.5,background:'var(--primary)',opacity:0.5}} />)}
                </div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Node colour = community</p>
                <div className="flex items-center gap-1">
                  {COMMUNITY_PALETTE.slice(0,6).map((c,i) => <div key={i} className="w-3 h-3 rounded-md" style={{background:c}} />)}
                </div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Arc = directed tie</p>
                <div className="flex items-center gap-1.5">
                  <svg width="32" height="14" viewBox="0 0 32 14">
                    <path d="M2,7 Q16,2 30,7" stroke="var(--primary)" strokeWidth="1.5" fill="none" opacity="0.7"/>
                    <polygon points="26,5 30,7 26,9" fill="var(--primary)" opacity="0.7"/>
                  </svg>
                  <span className="text-[10px] text-muted-foreground">curved</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rich tooltip */}
        {tooltip && tipNode && vizData && (
          <div className="absolute z-50 pointer-events-none"
            style={{ left: Math.min(tooltip.x, (containerRef.current?.clientWidth??900)-240), top: tooltip.y }}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 w-52"
              style={{ borderLeftColor: communityColor(vizData.metrics.community[tipNode.id]??0), borderLeftWidth: 3 }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: communityColor(vizData.metrics.community[tipNode.id]??0) }}>{tipNode.short}</div>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-foreground truncate">{tipNode.name}</p>
                  <p className="text-[10px] text-muted-foreground">Group {(vizData.metrics.community[tipNode.id]??0)+1}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {[
                  { l:'Received', v:vizData.indegree[tipNode.id], c:'#4A7A40' },
                  { l:'Sent', v:vizData.edges.filter(e=>e[0]===tipNode.id).length, c:'#6845A5' },
                ].map(s => (
                  <div key={s.l} className="bg-muted/60 rounded-xl p-2 text-center">
                    <p className="text-lg font-serif font-bold" style={{color:s.c}}>{s.v}</p>
                    <p className="text-[9px] text-muted-foreground">{s.l}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Centrality</p>
                {[
                  { l:'Betweenness', v:vizData.metrics.betweenness[tipNode.id]?.toFixed(3)??"—", c:'#CE2029' },
                  { l:'Closeness',   v:vizData.metrics.closeness[tipNode.id]?.toFixed(3)??"—",   c:'#D06828' },
                  { l:'Eigenvector', v:vizData.metrics.eigenvector[tipNode.id]?.toFixed(3)??"—", c:'#6845A5' },
                ].map(s => (
                  <div key={s.l} className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{s.l}</span>
                    <span className="text-[10px] font-bold font-mono tabular-nums" style={{color:s.c}}>{s.v}</span>
                  </div>
                ))}
              </div>
              {vizData.relTypes.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-border">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Received by type</p>
                  {vizData.relTypes.map(rt => {
                    const c = vizData.edges.filter(e=>e[1]===tipNode.id&&e[2]===rt.id).length
                    if (!c) return null
                    return (
                      <div key={rt.id} className="flex items-center gap-2 mb-0.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{background:vizData.edgeCfg[rt.id]?.color??'#888'}} />
                        <span className="text-[10px] text-foreground flex-1 truncate">{rt.label}</span>
                        <span className="text-[10px] font-bold" style={{color:vizData.edgeCfg[rt.id]?.color??'#888'}}>{c}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* No submissions overlay */}
        {vizData && vizData.submittedCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="font-serif text-lg text-foreground mb-1">No submissions yet</p>
              <p className="text-sm text-muted-foreground">
                {vizData.participantCount} participant{vizData.participantCount !== 1 ? 's' : ''} enrolled.
                The network appears once they submit.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
