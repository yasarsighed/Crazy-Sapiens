'use client'
import { useState, useEffect, useRef } from 'react'

// ─── Embedded dataset (400 comm + 27 avoidance + 76 advice edges) ─────────────
const GRAPH_DATA = {
  nodes:[{id:0,name:"Harshi"},{id:1,name:"Stutie Bidarkar"},{id:2,name:"Pooja Bharia"},{id:3,name:"Prapti Sargara"},{id:4,name:"Jenil Kotiya"},{id:5,name:"Niyati Vinchhi"},{id:6,name:"Vrinda Guru"},{id:7,name:"Sharma Nandani"},{id:8,name:"Ayushi Patel"},{id:9,name:"Deeya Kapadia"},{id:10,name:"Hinal Makwana"},{id:11,name:"Pradipta Poddar"},{id:12,name:"Shraddha Dubaji"},{id:13,name:"Bhumika Gehlot"},{id:14,name:"Laxita Barot"},{id:15,name:"Krishna Joshi"},{id:16,name:"Yasar Syed"},{id:17,name:"Grisha Vora"},{id:18,name:"Yash Pithva"},{id:19,name:"Ishika Bhandari"},{id:20,name:"Devyani"}],
  // edges: [source, target, type, score]  type: c=communication v=avoidance d=advice
  edges:[[0,9,"c",2],[0,10,"c",2],[0,11,"c",2],[0,7,"c",3],[0,12,"c",2],[0,3,"c",4],[0,13,"c",1],[0,14,"c",2],[0,15,"c",2],[0,16,"c",2],[0,17,"c",2],[0,2,"c",4],[0,18,"c",3],[0,5,"c",4],[0,19,"c",2],[0,8,"c",3],[0,20,"c",2],[0,4,"c",4],[0,6,"c",2],[0,1,"c",5],[10,9,"c",1],[10,11,"c",3],[10,7,"c",3],[10,12,"c",4],[10,3,"c",2],[10,13,"c",1],[10,14,"c",4],[10,15,"c",1],[10,16,"c",3],[10,17,"c",3],[10,2,"c",1],[10,0,"c",1],[10,18,"c",3],[10,5,"c",3],[10,19,"c",1],[10,8,"c",2],[10,20,"c",3],[10,4,"c",4],[10,6,"c",2],[10,1,"c",1],[12,9,"c",1],[12,10,"c",4],[12,11,"c",3],[12,7,"c",3],[12,3,"c",1],[12,13,"c",1],[12,14,"c",4],[12,15,"c",1],[12,16,"c",3],[12,17,"c",3],[12,2,"c",1],[12,0,"c",1],[12,18,"c",3],[12,5,"c",2],[12,19,"c",1],[12,8,"c",1],[12,20,"c",3],[12,4,"c",2],[12,6,"c",3],[12,1,"c",1],[19,9,"c",4],[19,10,"c",2],[19,11,"c",2],[19,7,"c",3],[19,12,"c",2],[19,3,"c",3],[19,13,"c",1],[19,14,"c",2],[19,15,"c",4],[19,16,"c",2],[19,17,"c",2],[19,2,"c",3],[19,0,"c",3],[19,18,"c",2],[19,5,"c",3],[19,8,"c",3],[19,20,"c",2],[19,4,"c",4],[19,6,"c",2],[19,1,"c",2],[6,9,"c",1],[6,10,"c",3],[6,11,"c",4],[6,7,"c",4],[6,12,"c",3],[6,3,"c",2],[6,13,"c",2],[6,14,"c",3],[6,15,"c",1],[6,16,"c",4],[6,17,"c",3],[6,2,"c",2],[6,0,"c",2],[6,18,"c",3],[6,5,"c",3],[6,19,"c",1],[6,8,"c",2],[6,20,"c",4],[6,4,"c",3],[6,1,"c",2],[3,9,"c",3],[3,10,"c",3],[3,11,"c",2],[3,7,"c",2],[3,12,"c",3],[3,13,"c",3],[3,14,"c",2],[3,15,"c",3],[3,16,"c",3],[3,17,"c",3],[3,2,"c",5],[3,0,"c",5],[3,18,"c",4],[3,5,"c",3],[3,19,"c",3],[3,8,"c",5],[3,20,"c",3],[3,4,"c",4],[3,6,"c",3],[3,1,"c",5],[15,9,"c",5],[15,10,"c",1],[15,11,"c",2],[15,7,"c",2],[15,12,"c",2],[15,3,"c",3],[15,13,"c",1],[15,14,"c",2],[15,16,"c",1],[15,17,"c",3],[15,2,"c",3],[15,0,"c",3],[15,18,"c",3],[15,5,"c",4],[15,19,"c",4],[15,8,"c",3],[15,20,"c",3],[15,4,"c",4],[15,6,"c",2],[15,1,"c",3],[16,11,"c",5],[16,10,"c",4],[16,9,"c",1],[16,7,"c",5],[16,12,"c",4],[16,3,"c",2],[16,13,"c",4],[16,14,"c",4],[16,15,"c",1],[16,17,"c",4],[16,2,"c",4],[16,0,"c",3],[16,18,"c",4],[16,5,"c",4],[16,19,"c",4],[16,8,"c",2],[16,20,"c",4],[16,4,"c",5],[16,6,"c",5],[16,1,"c",5],[2,9,"c",3],[2,10,"c",1],[2,11,"c",3],[2,7,"c",3],[2,12,"c",3],[2,3,"c",5],[2,13,"c",1],[2,14,"c",3],[2,15,"c",3],[2,16,"c",3],[2,0,"c",4],[2,17,"c",3],[2,18,"c",2],[2,5,"c",4],[2,19,"c",3],[2,8,"c",4],[2,20,"c",3],[2,4,"c",3],[2,6,"c",3],[2,1,"c",5],[4,9,"c",3],[4,10,"c",3],[4,11,"c",3],[4,7,"c",3],[4,12,"c",3],[4,3,"c",4],[4,13,"c",3],[4,14,"c",3],[4,15,"c",3],[4,16,"c",4],[4,17,"c",3],[4,2,"c",4],[4,0,"c",4],[4,18,"c",3],[4,5,"c",5],[4,19,"c",3],[4,8,"c",4],[4,20,"c",3],[4,6,"c",3],[4,1,"c",4],[7,9,"c",1],[7,15,"c",1],[7,19,"c",1],[7,5,"c",4],[7,18,"c",4],[7,11,"c",4],[7,16,"c",4],[7,10,"c",3],[7,12,"c",3],[7,3,"c",3],[7,13,"c",3],[7,14,"c",4],[7,17,"c",3],[7,2,"c",3],[7,0,"c",3],[7,8,"c",3],[7,20,"c",4],[7,4,"c",4],[7,6,"c",4],[7,1,"c",3],[14,9,"c",1],[14,10,"c",4],[14,11,"c",4],[14,7,"c",4],[14,12,"c",5],[14,3,"c",2],[14,13,"c",2],[14,15,"c",2],[14,16,"c",4],[14,17,"c",4],[14,2,"c",2],[14,0,"c",1],[14,18,"c",4],[14,5,"c",3],[14,19,"c",1],[14,8,"c",1],[14,20,"c",3],[14,4,"c",3],[14,6,"c",3],[14,1,"c",1],[8,9,"c",2],[8,10,"c",2],[8,11,"c",2],[8,7,"c",2],[8,12,"c",2],[8,3,"c",4],[8,13,"c",2],[8,14,"c",2],[8,15,"c",2],[8,16,"c",2],[8,17,"c",2],[8,2,"c",4],[8,0,"c",4],[8,18,"c",2],[8,5,"c",3],[8,19,"c",2],[8,20,"c",2],[8,4,"c",3],[8,6,"c",2],[8,1,"c",4],[11,9,"c",1],[11,10,"c",3],[11,7,"c",5],[11,12,"c",3],[11,3,"c",2],[11,13,"c",3],[11,14,"c",4],[11,15,"c",1],[11,16,"c",5],[11,17,"c",4],[11,2,"c",2],[11,0,"c",1],[11,18,"c",4],[11,5,"c",3],[11,19,"c",2],[11,8,"c",1],[11,20,"c",4],[11,4,"c",4],[11,6,"c",4],[11,1,"c",2],[9,10,"c",1],[9,11,"c",2],[9,7,"c",2],[9,12,"c",1],[9,3,"c",3],[9,13,"c",1],[9,14,"c",1],[9,15,"c",5],[9,16,"c",3],[9,17,"c",1],[9,2,"c",4],[9,0,"c",4],[9,18,"c",2],[9,5,"c",3],[9,19,"c",4],[9,8,"c",3],[9,20,"c",3],[9,4,"c",4],[9,6,"c",2],[9,1,"c",3],[5,9,"c",1],[5,10,"c",2],[5,11,"c",3],[5,7,"c",3],[5,12,"c",2],[5,3,"c",3],[5,13,"c",3],[5,14,"c",2],[5,15,"c",1],[5,16,"c",2],[5,17,"c",2],[5,2,"c",3],[5,0,"c",3],[5,18,"c",1],[5,19,"c",2],[5,8,"c",3],[5,20,"c",2],[5,4,"c",4],[5,6,"c",2],[5,1,"c",3],[1,9,"c",2],[1,10,"c",2],[1,11,"c",2],[1,7,"c",3],[1,12,"c",3],[1,3,"c",4],[1,13,"c",2],[1,14,"c",2],[1,15,"c",2],[1,16,"c",3],[1,17,"c",2],[1,2,"c",4],[1,0,"c",5],[1,18,"c",4],[1,5,"c",3],[1,19,"c",2],[1,8,"c",4],[1,20,"c",3],[1,4,"c",4],[1,6,"c",3],[17,10,"c",4],[17,11,"c",4],[17,7,"c",4],[17,12,"c",4],[17,3,"c",3],[17,13,"c",3],[17,9,"c",3],[17,14,"c",4],[17,15,"c",3],[17,16,"c",4],[17,2,"c",3],[17,0,"c",3],[17,18,"c",3],[17,5,"c",3],[17,19,"c",3],[17,8,"c",3],[17,20,"c",4],[17,4,"c",4],[17,6,"c",4],[17,1,"c",3],[13,9,"c",1],[13,10,"c",1],[13,11,"c",3],[13,7,"c",3],[13,12,"c",3],[13,3,"c",1],[13,14,"c",1],[13,15,"c",1],[13,16,"c",3],[13,17,"c",1],[13,2,"c",3],[13,0,"c",3],[13,18,"c",1],[13,5,"c",5],[13,19,"c",1],[13,8,"c",1],[13,20,"c",3],[13,4,"c",5],[13,6,"c",3],[13,1,"c",4],[20,10,"c",3],[20,11,"c",3],[20,9,"c",3],[20,7,"c",3],[20,12,"c",3],[20,3,"c",3],[20,13,"c",3],[20,14,"c",3],[20,15,"c",3],[20,16,"c",3],[20,17,"c",3],[20,2,"c",3],[20,0,"c",3],[20,18,"c",3],[20,5,"c",3],[20,19,"c",3],[20,8,"c",3],[20,4,"c",3],[20,6,"c",3],[20,1,"c",3],
  // avoidance (negative)
  [5,12,"v",1],[17,11,"v",1],[12,4,"v",1],[11,6,"v",1],[7,9,"v",1],[16,6,"v",1],[8,0,"v",1],[7,15,"v",1],[10,5,"v",1],[13,19,"v",1],[19,1,"v",1],[0,18,"v",1],[9,4,"v",1],[14,9,"v",1],[3,10,"v",1],[1,8,"v",1],[6,7,"v",1],[11,0,"v",1],[0,3,"v",1],[16,4,"v",1],[16,0,"v",1],[20,4,"v",1],[16,19,"v",1],[4,8,"v",1],[2,8,"v",1],[7,19,"v",1],[15,4,"v",1],
  // advice
  [17,18,"d",1],[9,15,"d",1],[1,18,"d",1],[19,9,"d",1],[20,1,"d",1],[14,4,"d",1],[0,1,"d",1],[19,2,"d",1],[19,15,"d",1],[4,18,"d",1],[1,4,"d",1],[12,4,"d",1],[16,8,"d",1],[11,5,"d",1],[1,0,"d",1],[10,1,"d",1],[20,8,"d",1],[6,1,"d",1],[0,5,"d",1],[7,20,"d",1],[17,4,"d",1],[13,4,"d",1],[8,4,"d",1],[20,5,"d",1],[11,18,"d",1],[6,8,"d",1],[3,4,"d",1],[11,7,"d",1],[6,5,"d",1],[2,4,"d",1],[15,1,"d",1],[7,5,"d",1],[13,0,"d",1],[16,18,"d",1],[12,10,"d",1],[2,0,"d",1],[3,0,"d",1],[16,7,"d",1],[15,9,"d",1],[9,4,"d",1],[5,4,"d",1],[16,11,"d",1],[19,3,"d",1],[11,4,"d",1],[7,18,"d",1],[10,18,"d",1],[19,0,"d",1],[6,7,"d",1],[10,7,"d",1],[16,4,"d",1],[14,5,"d",1],[9,19,"d",1],[0,4,"d",1],[1,5,"d",1],[13,1,"d",1],[2,1,"d",1],[20,4,"d",1],[7,11,"d",1],[3,1,"d",1],[13,2,"d",1],[12,14,"d",1],[6,4,"d",1],[7,4,"d",1],[17,5,"d",1],[10,4,"d",1],[13,5,"d",1],[2,8,"d",1],[11,16,"d",1],[3,2,"d",1],[3,8,"d",1],[10,0,"d",1],[9,1,"d",1],[12,7,"d",1],[4,5,"d",1],[9,20,"d",1],[15,4,"d",1]],
  indegree:[56,59,58,54,71,65,55,60,51,39,48,56,55,40,52,40,58,51,58,43,58]
}

const COLORS = {
  c: '#2D6A4F',   // communication - forest green
  v: '#E63946',   // avoidance - red
  d: '#F4A261',   // advice - orange
}

const LAYER_LABELS = {
  c: 'Communication',
  v: 'Avoidance',
  d: 'Advice-Seeking',
}

export default function SociogramPage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<any>(null)
  const [layers, setLayers] = useState({ c: true, v: true, d: true })
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [selectedNode, setSelectedNode] = useState<number | null>(null)
  const layersRef = useRef(layers)
  layersRef.current = layers

  useEffect(() => {
    // Load D3 from CDN
    if ((window as any).d3) { initViz(); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js'
    script.onload = () => { setLoaded(true); initViz() }
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (loaded) updateVisibility()
  }, [layers, loaded])

  function updateVisibility() {
    const d3 = (window as any).d3
    if (!d3 || !svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('.edge')
      .style('display', (d: any) => layersRef.current[d.type as 'c'|'v'|'d'] ? null : 'none')
  }

  function initViz() {
    const d3 = (window as any).d3
    if (!d3 || !svgRef.current || !containerRef.current) return

    const W = containerRef.current.clientWidth || 900
    const H = containerRef.current.clientHeight || 650

    // Clear
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', W)
      .attr('height', H)

    // Defs: arrow markers for each type
    const defs = svg.append('defs')
    Object.entries(COLORS).forEach(([type, color]) => {
      ;['1','2','3','4','5'].forEach(s => {
        defs.append('marker')
          .attr('id', `arrow-${type}-${s}`)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 18)
          .attr('refY', 0)
          .attr('markerWidth', 4 + Number(s) * 0.6)
          .attr('markerHeight', 4 + Number(s) * 0.6)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .attr('fill', color)
          .attr('opacity', type === 'v' ? 0.9 : 0.7)
      })
    })

    // Node sizes based on in-degree
    const maxDeg = Math.max(...GRAPH_DATA.indegree)
    const minDeg = Math.min(...GRAPH_DATA.indegree)
    const nodeRadius = (id: number) => {
      const deg = GRAPH_DATA.indegree[id] || 0
      return 10 + ((deg - minDeg) / (maxDeg - minDeg)) * 16
    }

    // Node colors by degree quartile
    const nodeColor = (id: number) => {
      const deg = GRAPH_DATA.indegree[id] || 0
      const pct = (deg - minDeg) / (maxDeg - minDeg)
      if (pct > 0.75) return '#2D6A4F'
      if (pct > 0.5) return '#457B9D'
      if (pct > 0.25) return '#E9C46A'
      return '#F4A261'
    }

    // Build D3-ready nodes and links
    const nodes: any[] = GRAPH_DATA.nodes.map(n => ({ ...n }))
    
    // For display, only show edges with score >= 2 for communication to reduce clutter
    // But always show avoidance and advice
    const links: any[] = GRAPH_DATA.edges
      .filter(e => e[2] === 'v' || e[2] === 'd' || (e[2] === 'c' && (e[3] as number) >= 2))
      .map(e => ({
        source: e[0],
        target: e[1],
        type: e[2],
        score: e[3],
        color: COLORS[e[2] as 'c'],
      }))

    // Zoom container
    const g = svg.append('g').attr('class', 'zoom-g')
    svg.call(
      d3.zoom()
        .scaleExtent([0.2, 4])
        .on('zoom', (event: any) => g.attr('transform', event.transform))
    )

    // Force simulation
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius((d: any) => nodeRadius(d.id) + 6))
    simRef.current = sim

    // Edges
    const edgeG = g.append('g').attr('class', 'edges')
    const edge = edgeG.selectAll('line')
      .data(links)
      .join('line')
      .attr('class', 'edge')
      .attr('stroke', (d: any) => d.color)
      .attr('stroke-width', (d: any) => d.type === 'v' ? 2 : Math.max(0.5, (d.score as number) * 0.5))
      .attr('stroke-opacity', (d: any) => d.type === 'v' ? 0.9 : d.type === 'd' ? 0.7 : 0.45)
      .attr('marker-end', (d: any) => `url(#arrow-${d.type}-${d.score})`)
      .style('display', (d: any) => layersRef.current[d.type as 'c'] ? null : 'none')

    // Nodes
    const nodeG = g.append('g').attr('class', 'nodes')
    const node = nodeG.selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(
        d3.drag()
          .on('start', (event: any, d: any) => {
            if (!event.active) sim.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event: any, d: any) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event: any, d: any) => {
            if (!event.active) sim.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )

    node.append('circle')
      .attr('r', (d: any) => nodeRadius(d.id))
      .attr('fill', (d: any) => nodeColor(d.id))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    node.append('text')
      .text((d: any) => {
        const name = d.name as string
        const parts = name.split(' ')
        return parts[0]
      })
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => nodeRadius(d.id) + 12)
      .attr('font-size', '10px')
      .attr('fill', '#3D3028')
      .attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .attr('pointer-events', 'none')

    // Node hover
    node
      .on('mouseenter', function(event: any, d: any) {
        const rect = containerRef.current!.getBoundingClientRect()
        const inLinks = links.filter(l => (l.target as any).id === d.id)
        const outLinks = links.filter(l => (l.source as any).id === d.id)
        const avoidTargets = outLinks.filter(l => l.type === 'v').map(l => (l.target as any).name)
        const avoidSources = inLinks.filter(l => l.type === 'v').map(l => (l.source as any).name)
        const text = [
          `📍 ${d.name}`,
          `In-degree: ${GRAPH_DATA.indegree[d.id]}`,
          `Receives: ${inLinks.filter(l=>l.type==='c').length} comm connections`,
          avoidTargets.length ? `⚠ Avoids: ${avoidTargets.join(', ')}` : '',
          avoidSources.length ? `⚠ Avoided by: ${avoidSources.join(', ')}` : '',
        ].filter(Boolean).join('\n')
        setTooltip({ x: event.clientX - rect.left + 12, y: event.clientY - rect.top - 10, text })
      })
      .on('mousemove', function(event: any) {
        const rect = containerRef.current!.getBoundingClientRect()
        setTooltip(prev => prev ? { ...prev, x: event.clientX - rect.left + 12, y: event.clientY - rect.top - 10 } : null)
      })
      .on('mouseleave', () => setTooltip(null))

    // Tick
    sim.on('tick', () => {
      edge
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })
  }

  const toggleLayer = (type: 'c' | 'v' | 'd') => {
    setLayers(prev => ({ ...prev, [type]: !prev[type] }))
  }

  return (
    <div className="flex flex-col h-screen bg-[#F5F0E8]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#E8E0D5] shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-[#3D3028]" style={{fontFamily:'Fraunces,serif'}}>
            Workplace Relationship Network
          </h1>
          <p className="text-xs text-[#8B7355]">21 participants · 400 communication ties · 27 avoidance ties · 76 advice ties</p>
        </div>

        {/* Layer toggles */}
        <div className="flex gap-2">
          {(['c','v','d'] as const).map(type => (
            <button
              key={type}
              onClick={() => toggleLayer(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                layers[type]
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-[#8B7355] border-[#D4C5B0]'
              }`}
              style={layers[type] ? { backgroundColor: COLORS[type] } : {}}
            >
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[type] }} />
              {LAYER_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-[#8B7355]">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[8,12,16,20,24].map(s => (
                <div key={s} className="rounded-full" style={{width:s/2,height:s/2,backgroundColor:'#2D6A4F',opacity:0.7}} />
              ))}
            </div>
            <span>Node = in-degree</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5 items-end">
              {[1,2,3].map(s => (
                <div key={s} style={{width:16,height:s*1.5,backgroundColor:'#2D6A4F',opacity:0.5}} />
              ))}
            </div>
            <span>Thickness = strength</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 bg-[#3D3028] text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none max-w-xs"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text.split('\n').map((line, i) => (
              <div key={i} className={i === 0 ? 'font-semibold mb-1' : i > 1 && line.startsWith('⚠') ? 'text-red-300' : 'text-gray-200'}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Help text */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-[#8B7355] bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
          Scroll to zoom · Drag nodes · Hover for details
        </div>
      </div>
    </div>
  )
}