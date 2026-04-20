'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbParticipant {
  id: string
  display_name: string
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

interface VizNode {
  id: number
  name: string
  short: string
  dept: string
  role: string
}

type EdgeTuple = [number, number, string, number]
type EdgeCfg = Record<string, { label: string; color: string; dash: string | null; opacity: (s: number) => number }>
type DeptColors = Record<string, string>

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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_COLORS = ['#2D6A4F', '#457B9D', '#E76F51', '#E9C46A', '#6D6875', '#A8DADC']

function initials(name: string) {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

const rScale = (nodeIdx: number, indegree: number[], nodes: VizNode[]) => {
  const min = Math.min(...indegree)
  const max = Math.max(...indegree)
  return max === min ? 14 : 10 + ((indegree[nodeIdx] - min) / (max - min)) * 14
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SociogramResultsPage() {
  const params = useParams()
  const studyId = params.id as string

  const svgRef       = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef       = useRef<any>(null)
  const zoomRef      = useRef<any>(null)
  const svgSel       = useRef<any>(null)
  const pinnedRef    = useRef<Set<number>>(new Set())

  const [vizData, setVizData]     = useState<VizData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [d3Loaded, setD3Loaded]   = useState(false)
  const [settled, setSettled]     = useState(false)
  const [focusNode, setFocusNode] = useState<number | null>(null)
  const [search, setSearch]       = useState('')
  const [showLabels, setShowLabels] = useState(true)
  const [tooltip, setTooltip]     = useState<{ x: number; y: number; id: number } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [minScore, setMinScore]   = useState(1)
  const [activeRelTypes, setActiveRelTypes] = useState<Set<string>>(new Set())

  const stateRef = useRef({ focusNode, search, showLabels, activeRelTypes, minScore, vizData })
  stateRef.current = { focusNode, search, showLabels, activeRelTypes, minScore, vizData }

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()

      // Find sociogram instruments for this study
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

      // Load participants, nominations, relationship types in parallel
      const [partRes, nomRes, relRes, subRes] = await Promise.all([
        supabase
          .from('sociogram_participants')
          .select('id, display_name')
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

      // Build node index
      const nodeIdxById: Record<string, number> = {}
      const nodes: VizNode[] = participants.map((p, i) => {
        nodeIdxById[p.id] = i
        return {
          id: i,
          name: p.display_name,
          short: initials(p.display_name),
          dept: 'Participant',
          role: p.display_name,
        }
      })

      // Build edge config from relationship types
      const edgeCfg: EdgeCfg = {}
      const deptColors: DeptColors = { Participant: '#2D6A4F' }
      relTypes.forEach((rt, i) => {
        const key = rt.id
        const color = rt.color_hex || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
        edgeCfg[key] = {
          label: rt.label,
          color,
          dash: rt.is_negative_dimension ? '5 3' : null,
          opacity: rt.is_negative_dimension ? (_: number) => 0.85 : (s: number) => 0.2 + s * 0.1,
        }
      })

      // Build edges
      const edges: EdgeTuple[] = nominations
        .filter(n => nodeIdxById[n.nominator_id] !== undefined && nodeIdxById[n.nominee_id] !== undefined)
        .map(n => [
          nodeIdxById[n.nominator_id],
          nodeIdxById[n.nominee_id],
          n.relationship_type_id,
          n.score ?? 3,
        ])

      // Compute in-degree
      const indegree = nodes.map((_, i) => edges.filter(e => e[1] === i).length)

      const allRelTypeIds = new Set(relTypes.map(rt => rt.id))

      setVizData({
        nodes,
        edges,
        indegree,
        edgeCfg,
        deptColors,
        relTypes,
        participantCount: participants.length,
        submittedCount,
        sociogramTitle: sociogram.title,
      })
      setActiveRelTypes(allRelTypeIds)
      setLoading(false)
    }
    load()
  }, [studyId])

  // ── Load D3 ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if ((window as any).d3) { setD3Loaded(true); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js'
    s.onload = () => setD3Loaded(true)
    document.head.appendChild(s)
  }, [])

  // ── Build viz when both data and d3 are ready ─────────────────────────────

  useEffect(() => {
    if (d3Loaded && vizData) {
      buildViz(vizData)
    }
    return () => simRef.current?.stop()
  }, [d3Loaded, vizData])

  // ── Apply filters reactively ──────────────────────────────────────────────

  useEffect(() => { applyFilters() }, [focusNode, search, showLabels, activeRelTypes, minScore])

  const applyFilters = useCallback(() => {
    const d3 = (window as any).d3
    if (!d3 || !svgSel.current) return
    const { focusNode: fn, search: sq, showLabels: sl, activeRelTypes: art, minScore: ms, vizData: vd } = stateRef.current
    if (!vd) return
    const lq = sq.toLowerCase()

    svgSel.current.selectAll('.edge').each(function (d: any) {
      const show =
        art.has(d.typeId) &&
        (d.typeId === 'communication' ? d.score >= ms : true) &&
        (fn === null || d.source.id === fn || d.target.id === fn)
      d3.select(this).style('display', show ? null : 'none')
    })

    svgSel.current.selectAll('.node-g').each(function (d: any) {
      const nameMatch = !lq || (d.name as string).toLowerCase().includes(lq)
      const focusDim = fn !== null && d.id !== fn && !vd.edges.some(e => (e[0] === fn && e[1] === d.id) || (e[1] === fn && e[0] === d.id))
      const dim = focusDim || (!!lq && !nameMatch)
      d3.select(this).attr('opacity', dim ? 0.12 : 1)
    })

    svgSel.current.selectAll('.node-label').style('display', sl ? null : 'none')
  }, [])

  function buildViz(vd: VizData) {
    const d3 = (window as any).d3
    if (!d3 || !svgRef.current || !containerRef.current) return

    const W = containerRef.current.clientWidth || 900
    const H = containerRef.current.clientHeight || 680

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H)
    svgSel.current = svg

    const defs = svg.append('defs')

    // Shadow
    const sh = defs.append('filter').attr('id', 'nshadow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%')
    sh.append('feDropShadow').attr('dx', 0).attr('dy', 1.5).attr('stdDeviation', 3).attr('flood-color', 'rgba(0,0,0,0.18)')

    // Arrow markers per relationship type
    Object.entries(vd.edgeCfg).forEach(([typeId, cfg]) => {
      [1, 2, 3, 4, 5].forEach(s => {
        defs.append('marker')
          .attr('id', `ar-${typeId.replace(/[^a-zA-Z0-9]/g, '_')}-${s}`)
          .attr('viewBox', '0 -4 8 8').attr('refX', 16).attr('refY', 0)
          .attr('markerWidth', 4 + s * 0.35).attr('markerHeight', 4 + s * 0.35)
          .attr('orient', 'auto')
          .append('path').attr('d', 'M0,-4L8,0L0,4')
          .attr('fill', cfg.color).attr('opacity', 0.85)
      })
    })

    // Node gradients
    vd.nodes.forEach(n => {
      const col = '#2D6A4F'
      const g = defs.append('radialGradient').attr('id', `gr-${n.id}`).attr('cx', '38%').attr('cy', '35%').attr('r', '65%')
      g.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', 0.9)
      g.append('stop').attr('offset', '50%').attr('stop-color', col).attr('stop-opacity', 0.92)
      g.append('stop').attr('offset', '100%').attr('stop-color', col)
    })

    svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#F5F0E8')

    const g = svg.append('g').attr('class', 'root-g')
    const zoom = d3.zoom().scaleExtent([0.1, 5]).on('zoom', (ev: any) => g.attr('transform', ev.transform))
    zoomRef.current = zoom
    svg.call(zoom)

    // Edges
    const nodeById = Object.fromEntries(vd.nodes.map(n => [n.id, n]))
    const links = vd.edges.map(([s, t, typeId, score]) => ({
      source: s, target: t, typeId, score,
      ...(vd.edgeCfg[typeId] || { label: typeId, color: '#999', dash: null, opacity: () => 0.4 }),
    }))

    const edgeG = g.append('g')
    const edge = edgeG.selectAll('line').data(links).join('line')
      .attr('class', 'edge')
      .attr('stroke', (d: any) => d.color)
      .attr('stroke-width', (d: any) => Math.max(0.8, d.score * 0.5))
      .attr('stroke-opacity', (d: any) => (d.opacity as (s: number) => number)(d.score))
      .attr('stroke-dasharray', (d: any) => d.dash || null)
      .attr('marker-end', (d: any) => `url(#ar-${d.typeId.replace(/[^a-zA-Z0-9]/g, '_')}-${Math.max(1, Math.min(5, Math.round(d.score)))})`)

    // Nodes
    const nodeData = vd.nodes.map(n => ({ ...n }))
    let clickTimer: any = null

    const nodeG = g.append('g')
    const node = nodeG.selectAll('g').data(nodeData).join('g')
      .attr('class', 'node-g')
      .style('cursor', 'pointer')
      .call(
        d3.drag()
          .on('start', (ev: any, d: any) => {
            if (!ev.active) simRef.current?.alphaTarget(0.02).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (ev: any, d: any) => { d.fx = ev.x; d.fy = ev.y })
          .on('end', (ev: any, d: any) => {
            if (!ev.active) simRef.current?.alphaTarget(0)
            if (!pinnedRef.current.has(d.id)) { d.fx = null; d.fy = null }
          })
      )
      .on('click', (_ev: any, d: any) => {
        clearTimeout(clickTimer)
        clickTimer = setTimeout(() => setFocusNode((p: any) => p === d.id ? null : d.id), 180)
      })
      .on('dblclick', (_ev: any, d: any) => {
        clearTimeout(clickTimer)
        const d3_ = (window as any).d3
        if (pinnedRef.current.has(d.id)) {
          pinnedRef.current.delete(d.id)
          d.fx = null; d.fy = null
          d3_.select(_ev.currentTarget).select('.pin-dot').attr('display', 'none')
        } else {
          pinnedRef.current.add(d.id)
          d.fx = d.x; d.fy = d.y
          d3_.select(_ev.currentTarget).select('.pin-dot').attr('display', null)
        }
      })
      .on('mouseenter', (ev: any, d: any) => {
        const r = containerRef.current!.getBoundingClientRect()
        setTooltip({ x: ev.clientX - r.left + 14, y: ev.clientY - r.top - 10, id: d.id })
      })
      .on('mousemove', (ev: any) => {
        const r = containerRef.current!.getBoundingClientRect()
        setTooltip(p => p ? { ...p, x: ev.clientX - r.left + 14, y: ev.clientY - r.top - 10 } : null)
      })
      .on('mouseleave', () => setTooltip(null))

    node.append('circle')
      .attr('r', (d: any) => rScale(d.id, vd.indegree, vd.nodes) + 2)
      .attr('fill', '#F5F0E8').attr('stroke', 'none').attr('filter', 'url(#nshadow)')

    node.append('circle')
      .attr('r', (d: any) => rScale(d.id, vd.indegree, vd.nodes) + 1.5)
      .attr('fill', 'none').attr('stroke', '#2D6A4F').attr('stroke-width', 2).attr('opacity', 0.6)

    node.append('circle')
      .attr('r', (d: any) => rScale(d.id, vd.indegree, vd.nodes))
      .attr('fill', (d: any) => `url(#gr-${d.id})`)

    node.each(function (d: any) {
      const sel = (window as any).d3.select(this)
      const r = rScale(d.id, vd.indegree, vd.nodes)
      const hR = r * 0.3, hY = -r * 0.16
      sel.append('circle').attr('cx', 0).attr('cy', hY).attr('r', hR)
        .attr('fill', 'rgba(255,255,255,0.92)').attr('stroke', 'none')
      const sw = r * 0.72, sy = r * 0.28
      sel.append('path')
        .attr('d', `M${-sw},${sy + r * 0.35} Q${-sw},${sy} 0,${sy} Q${sw},${sy} ${sw},${sy + r * 0.35}`)
        .attr('fill', 'rgba(255,255,255,0.82)')
    })

    node.append('circle').attr('class', 'pin-dot')
      .attr('cx', (d: any) => rScale(d.id, vd.indegree, vd.nodes) * 0.65)
      .attr('cy', (d: any) => -rScale(d.id, vd.indegree, vd.nodes) * 0.65)
      .attr('r', 3.5).attr('fill', '#F4A261').attr('stroke', 'white').attr('stroke-width', 1)
      .attr('display', 'none')

    node.append('text').attr('class', 'node-label')
      .text((d: any) => {
        const parts = d.name.split(' ')
        return rScale(d.id, vd.indegree, vd.nodes) >= 20 ? parts.slice(0, 2).join(' ') : parts[0]
      })
      .attr('text-anchor', 'middle')
      .attr('y', (d: any) => rScale(d.id, vd.indegree, vd.nodes) + 13)
      .attr('font-size', '9.5px').attr('font-weight', '700')
      .attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .attr('fill', '#3D3028').attr('pointer-events', 'none')

    // Simulation
    const sim = d3.forceSimulation(nodeData)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(90).strength(0.22))
      .force('charge', d3.forceManyBody().strength(-420))
      .force('center', d3.forceCenter(W / 2, H / 2).strength(0.04))
      .force('collision', d3.forceCollide().radius((d: any) => rScale(d.id, vd.indegree, vd.nodes) + 10))
      .alphaDecay(0.04)
      .velocityDecay(0.55)

    simRef.current = sim

    let tc = 0
    sim.on('tick', () => {
      tc++; if (tc % 2 !== 0) return
      edge.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y)
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    sim.on('end', () => {
      nodeData.forEach(n => { n.fx = n.x; n.fy = n.y })
      sim.stop()
      setSettled(true)
    })

    setTimeout(applyFilters, 80)
  }

  const zoomBy = (k: number) => {
    const d3 = (window as any).d3; if (!d3 || !svgRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, k)
  }
  const zoomFit = () => {
    const d3 = (window as any).d3; if (!d3 || !svgRef.current) return
    d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity)
  }
  const exportSVG = () => {
    const svg = svgRef.current; if (!svg) return
    const s = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([s], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'sociogram.svg'; a.click()
    URL.revokeObjectURL(url)
  }

  const toggleRelType = (id: string) => setActiveRelTypes(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  // ── Derived ──────────────────────────────────────────────────────────────

  const topNodes = vizData
    ? [...vizData.nodes].sort((a, b) => vizData.indegree[b.id] - vizData.indegree[a.id]).slice(0, 5)
    : []

  const tipNode = tooltip && vizData ? vizData.nodes[tooltip.id] : null

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F0E8]">
        <p className="text-sm text-[#8B7355]">Loading sociogram data...</p>
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
            <p className="text-[9px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">Relationships</p>
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
                  <span
                    className="w-7 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: active ? cfg.color : '#DDD6CC' }}
                  />
                  <span className="font-semibold">{rt.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Most connected */}
        {topNodes.length > 0 && (
          <div className="px-4 py-3 border-b border-[#E8E0D5]">
            <p className="text-[9px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">Most Connected</p>
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
                <span className="text-[9px] font-semibold text-[#2D6A4F]">{vizData?.indegree[n.id] ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        {/* View options */}
        <div className="px-4 py-3">
          <p className="text-[9px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">View</p>
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <div
              onClick={() => setShowLabels(p => !p)}
              className={`w-8 h-4 rounded-full transition-colors relative ${showLabels ? 'bg-[#2D6A4F]' : 'bg-[#DDD6CC]'}`}
            >
              <span
                className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all"
                style={{ left: showLabels ? 18 : 2 }}
              />
            </div>
            <span className="text-[11px] text-[#3D3028] font-medium">Show name labels</span>
          </label>
          <p className="text-[9px] text-[#8B7355] mt-2">Double-click a node to pin it</p>
          <p className="text-[9px] text-[#8B7355]">Click to focus · Scroll to zoom</p>
        </div>

        <div className="mt-auto px-4 py-3 border-t border-[#E8E0D5]">
          <p className="text-[9px] text-[#B5A898] leading-relaxed">
            {vizData?.submittedCount}/{vizData?.participantCount} participants submitted
          </p>
        </div>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" />

        {/* Top right controls */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="flex items-center bg-white border border-[#E8E0D5] rounded-xl shadow-sm overflow-hidden">
            <button onClick={() => zoomBy(1.35)} className="w-8 h-8 flex items-center justify-center text-[#8B7355] hover:bg-[#F5F0E8] hover:text-[#2D6A4F] transition-all text-base">+</button>
            <div className="w-px h-5 bg-[#E8E0D5]" />
            <button onClick={zoomFit} className="px-2.5 h-8 text-[9px] font-bold text-[#8B7355] hover:bg-[#F5F0E8] hover:text-[#2D6A4F] transition-all tracking-wider">FIT</button>
            <div className="w-px h-5 bg-[#E8E0D5]" />
            <button onClick={() => zoomBy(0.74)} className="w-8 h-8 flex items-center justify-center text-[#8B7355] hover:bg-[#F5F0E8] hover:text-[#2D6A4F] transition-all text-base">−</button>
          </div>
          <button onClick={exportSVG} title="Export SVG" className="w-8 h-8 bg-white border border-[#E8E0D5] rounded-xl shadow-sm text-[#8B7355] hover:text-[#2D6A4F] hover:border-[#2D6A4F]/40 transition-all flex items-center justify-center text-xs">↓</button>
          <button onClick={() => setFullscreen(p => !p)} className="w-8 h-8 bg-white border border-[#E8E0D5] rounded-xl shadow-sm text-[#8B7355] hover:text-[#2D6A4F] hover:border-[#2D6A4F]/40 transition-all flex items-center justify-center text-xs">
            {fullscreen ? '⊠' : '⊡'}
          </button>
        </div>

        {/* Status pill */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur border border-[#E8E0D5] rounded-lg px-2.5 py-1.5 shadow-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${settled ? 'bg-[#2D6A4F]' : 'bg-[#F4A261]'}`} />
            <span className="text-[9px] text-[#8B7355]">{settled ? 'Layout ready' : 'Computing layout…'}</span>
          </div>
          {focusNode !== null && vizData && (
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur border border-[#2D6A4F]/30 rounded-lg px-2.5 py-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]" />
              <span className="text-[9px] font-semibold text-[#2D6A4F]">{vizData.nodes[focusNode]?.name}</span>
              <button onClick={() => setFocusNode(null)} className="text-[9px] text-[#8B7355] hover:text-[#3D3028] ml-0.5">✕</button>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4">
          <div className="bg-white/85 backdrop-blur border border-[#E8E0D5] rounded-xl px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[8px] font-bold text-[#8B7355] uppercase tracking-wider mb-1.5">Node size</p>
                <div className="flex items-center gap-1.5">
                  {[8, 12, 16, 20, 24].map(s => (
                    <div key={s} className="rounded-full bg-[#2D6A4F] opacity-60" style={{ width: s / 3 * 2, height: s / 3 * 2 }} />
                  ))}
                  <span className="text-[9px] text-[#8B7355] ml-1">= centrality</span>
                </div>
              </div>
              <div className="w-px h-8 bg-[#E8E0D5]" />
              <div>
                <p className="text-[8px] font-bold text-[#8B7355] uppercase tracking-wider mb-1.5">Line weight</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map(s => (
                    <div key={s} className="bg-[#2D6A4F] opacity-60 rounded" style={{ width: 16, height: s * 1.5 }} />
                  ))}
                  <span className="text-[9px] text-[#8B7355] ml-1">= tie strength</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && tipNode && vizData && (
          <div className="absolute z-40 pointer-events-none" style={{ left: tooltip.x, top: tooltip.y }}>
            <div className="bg-white border border-[#E8E0D5] rounded-2xl p-4 shadow-xl min-w-[180px]" style={{ borderLeftColor: '#2D6A4F', borderLeftWidth: 3 }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex-shrink-0 relative overflow-hidden" style={{ background: '#2D6A4F' }}>
                  <svg viewBox="0 0 40 40" className="w-full h-full absolute inset-0">
                    <circle cx="20" cy="14" r="7" fill="rgba(255,255,255,0.9)" />
                    <path d="M4 40 Q4 27 20 27 Q36 27 36 40" fill="rgba(255,255,255,0.8)" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#3D3028]">{tipNode.name}</p>
                  <p className="text-[9px] text-[#8B7355]">In-degree: {vizData.indegree[tipNode.id]}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { l: 'Received', v: vizData.indegree[tipNode.id], c: '#2D6A4F' },
                  { l: 'Sent', v: vizData.edges.filter(e => e[0] === tipNode.id).length, c: '#457B9D' },
                ].map(s => (
                  <div key={s.l} className="bg-[#FAF8F4] rounded-lg p-2 text-center">
                    <p className="text-sm font-black" style={{ color: s.c }}>{s.v}</p>
                    <p className="text-[8px] text-[#8B7355] leading-tight mt-0.5">{s.l}</p>
                  </div>
                ))}
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
