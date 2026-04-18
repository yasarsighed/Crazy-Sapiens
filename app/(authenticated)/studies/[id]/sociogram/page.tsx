'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const NODES = [
  { id:0,  name:'Harshi',            short:'Ha', dept:'MA-2',     role:'Intern' },
  { id:1,  name:'Stutie Bidarkar',   short:'SB', dept:'MA-2',     role:'Intern' },
  { id:2,  name:'Pooja Bharia',      short:'PB', dept:'MA-2',     role:'Intern' },
  { id:3,  name:'Prapti Sargara',    short:'PS', dept:'MA-2',     role:'Intern' },
  { id:4,  name:'Jenil Kotiya',      short:'JK', dept:'Senior',   role:'Supervisor' },
  { id:5,  name:'Niyati Vinchhi',    short:'NV', dept:'Senior',   role:'Head Counsellor' },
  { id:6,  name:'Vrinda R. Guru',    short:'VG', dept:'MA-1 HPP', role:'Clinical' },
  { id:7,  name:'Nandani Sharma',    short:'NS', dept:'MA-1 GIA', role:'Edu Psy' },
  { id:8,  name:'Ayushi Patel',      short:'AP', dept:'MA-2',     role:'Intern' },
  { id:9,  name:'Deeya Kapadia',     short:'DK', dept:'Baby',     role:'Intern' },
  { id:10, name:'Hinal Makwana',     short:'HM', dept:'MA-1 HPP', role:'Psychology' },
  { id:11, name:'Pradipta Poddar',   short:'PP', dept:'MA-1 HPP', role:'Clinical' },
  { id:12, name:'Shraddha Dubaji',   short:'SD', dept:'MA-1 HPP', role:'Clinical' },
  { id:13, name:'Bhumika Gehlot',    short:'BG', dept:'MA-2',     role:'Intern' },
  { id:14, name:'Laxita Barot',      short:'LB', dept:'MA-1 GIA', role:'Edu Psy' },
  { id:15, name:'Krishna Joshi',     short:'KJ', dept:'Baby',     role:'Intern' },
  { id:16, name:'Yasar Syed',        short:'YS', dept:'MA-1 GIA', role:'Counselling' },
  { id:17, name:'Grisha Vora',       short:'GV', dept:'MA-1 HPP', role:'Counselling' },
  { id:18, name:'Yash Pithva',       short:'YP', dept:'Senior',   role:'Senior Intern' },
  { id:19, name:'Ishika Bhandari',   short:'IB', dept:'Baby',     role:'Intern' },
  { id:20, name:'Devyani Kedar',     short:'DV', dept:'MA-1 HPP', role:'Counselling' },
]

// Dept colors that work well on both the node AND the light canvas
const DEPT_COLORS: Record<string,string> = {
  'Senior':    '#D4A017',
  'MA-2':      '#2D9B6F',
  'MA-1 HPP':  '#3A7BD5',
  'MA-1 GIA':  '#9B5EA2',
  'Baby':      '#D4711A',
}

const INDEGREE = [56,59,58,54,71,65,55,60,51,39,48,56,55,40,52,40,58,51,58,43,58]

// Relationship edge colors — distinct, readable on light background
const EDGE_CFG = {
  c: { label:'Communication', color:'#2D6A4F', dash:null,    opacity:(s:number)=>0.18+s*0.09 },
  v: { label:'Avoidance',     color:'#C0392B', dash:'5 3',   opacity:(_:number)=>0.85 },
  d: { label:'Advice-seeking',color:'#B7770D', dash:'2 2',   opacity:(_:number)=>0.65 },
}
type EType = 'c'|'v'|'d'

const EDGES:[number,number,EType,number][] = [
  [0,9,"c",2],[0,10,"c",2],[0,11,"c",2],[0,7,"c",3],[0,12,"c",2],[0,3,"c",4],[0,13,"c",1],[0,14,"c",2],[0,15,"c",2],[0,16,"c",2],[0,17,"c",2],[0,2,"c",4],[0,18,"c",3],[0,5,"c",4],[0,19,"c",2],[0,8,"c",3],[0,20,"c",2],[0,4,"c",4],[0,6,"c",2],[0,1,"c",5],
  [10,9,"c",1],[10,11,"c",3],[10,7,"c",3],[10,12,"c",4],[10,3,"c",2],[10,13,"c",1],[10,14,"c",4],[10,15,"c",1],[10,16,"c",3],[10,17,"c",3],[10,2,"c",1],[10,0,"c",1],[10,18,"c",3],[10,5,"c",3],[10,19,"c",1],[10,8,"c",2],[10,20,"c",3],[10,4,"c",4],[10,6,"c",2],[10,1,"c",1],
  [12,9,"c",1],[12,10,"c",4],[12,11,"c",3],[12,7,"c",3],[12,3,"c",1],[12,13,"c",1],[12,14,"c",4],[12,15,"c",1],[12,16,"c",3],[12,17,"c",3],[12,2,"c",1],[12,0,"c",1],[12,18,"c",3],[12,5,"c",2],[12,19,"c",1],[12,8,"c",1],[12,20,"c",3],[12,4,"c",2],[12,6,"c",3],[12,1,"c",1],
  [19,9,"c",4],[19,10,"c",2],[19,11,"c",2],[19,7,"c",3],[19,12,"c",2],[19,3,"c",3],[19,13,"c",1],[19,14,"c",2],[19,15,"c",4],[19,16,"c",2],[19,17,"c",2],[19,2,"c",3],[19,0,"c",3],[19,18,"c",2],[19,5,"c",3],[19,8,"c",3],[19,20,"c",2],[19,4,"c",4],[19,6,"c",2],[19,1,"c",2],
  [6,9,"c",1],[6,10,"c",3],[6,11,"c",4],[6,7,"c",4],[6,12,"c",3],[6,3,"c",2],[6,13,"c",2],[6,14,"c",3],[6,15,"c",1],[6,16,"c",4],[6,17,"c",3],[6,2,"c",2],[6,0,"c",2],[6,18,"c",3],[6,5,"c",3],[6,19,"c",1],[6,8,"c",2],[6,20,"c",4],[6,4,"c",3],[6,1,"c",2],
  [3,9,"c",3],[3,10,"c",3],[3,11,"c",2],[3,7,"c",2],[3,12,"c",3],[3,13,"c",3],[3,14,"c",2],[3,15,"c",3],[3,16,"c",3],[3,17,"c",3],[3,2,"c",5],[3,0,"c",5],[3,18,"c",4],[3,5,"c",3],[3,19,"c",3],[3,8,"c",5],[3,20,"c",3],[3,4,"c",4],[3,6,"c",3],[3,1,"c",5],
  [15,9,"c",5],[15,10,"c",1],[15,11,"c",2],[15,7,"c",2],[15,12,"c",2],[15,3,"c",3],[15,13,"c",1],[15,14,"c",2],[15,16,"c",1],[15,17,"c",3],[15,2,"c",3],[15,0,"c",3],[15,18,"c",3],[15,5,"c",4],[15,19,"c",4],[15,8,"c",3],[15,20,"c",3],[15,4,"c",4],[15,6,"c",2],[15,1,"c",3],
  [16,11,"c",5],[16,10,"c",4],[16,9,"c",1],[16,7,"c",5],[16,12,"c",4],[16,3,"c",2],[16,13,"c",4],[16,14,"c",4],[16,15,"c",1],[16,17,"c",4],[16,2,"c",4],[16,0,"c",3],[16,18,"c",4],[16,5,"c",4],[16,19,"c",4],[16,8,"c",2],[16,20,"c",4],[16,4,"c",5],[16,6,"c",5],[16,1,"c",5],
  [2,9,"c",3],[2,10,"c",1],[2,11,"c",3],[2,7,"c",3],[2,12,"c",3],[2,3,"c",5],[2,13,"c",1],[2,14,"c",3],[2,15,"c",3],[2,16,"c",3],[2,0,"c",4],[2,17,"c",3],[2,18,"c",2],[2,5,"c",4],[2,19,"c",3],[2,8,"c",4],[2,20,"c",3],[2,4,"c",3],[2,6,"c",3],[2,1,"c",5],
  [4,9,"c",3],[4,10,"c",3],[4,11,"c",3],[4,7,"c",3],[4,12,"c",3],[4,3,"c",4],[4,13,"c",3],[4,14,"c",3],[4,15,"c",3],[4,16,"c",4],[4,17,"c",3],[4,2,"c",4],[4,0,"c",4],[4,18,"c",3],[4,5,"c",5],[4,19,"c",3],[4,8,"c",4],[4,20,"c",3],[4,6,"c",3],[4,1,"c",4],
  [7,9,"c",1],[7,15,"c",1],[7,19,"c",1],[7,5,"c",4],[7,18,"c",4],[7,11,"c",4],[7,16,"c",4],[7,10,"c",3],[7,12,"c",3],[7,3,"c",3],[7,13,"c",3],[7,14,"c",4],[7,17,"c",3],[7,2,"c",3],[7,0,"c",3],[7,8,"c",3],[7,20,"c",4],[7,4,"c",4],[7,6,"c",4],[7,1,"c",3],
  [14,9,"c",1],[14,10,"c",4],[14,11,"c",4],[14,7,"c",4],[14,12,"c",5],[14,3,"c",2],[14,13,"c",2],[14,15,"c",2],[14,16,"c",4],[14,17,"c",4],[14,2,"c",2],[14,0,"c",1],[14,18,"c",4],[14,5,"c",3],[14,19,"c",1],[14,8,"c",1],[14,20,"c",3],[14,4,"c",3],[14,6,"c",3],[14,1,"c",1],
  [8,9,"c",2],[8,10,"c",2],[8,11,"c",2],[8,7,"c",2],[8,12,"c",2],[8,3,"c",4],[8,13,"c",2],[8,14,"c",2],[8,15,"c",2],[8,16,"c",2],[8,17,"c",2],[8,2,"c",4],[8,0,"c",4],[8,18,"c",2],[8,5,"c",3],[8,19,"c",2],[8,20,"c",2],[8,4,"c",3],[8,6,"c",2],[8,1,"c",4],
  [11,9,"c",1],[11,10,"c",3],[11,7,"c",5],[11,12,"c",3],[11,3,"c",2],[11,13,"c",3],[11,14,"c",4],[11,15,"c",1],[11,16,"c",5],[11,17,"c",4],[11,2,"c",2],[11,0,"c",1],[11,18,"c",4],[11,5,"c",3],[11,19,"c",2],[11,8,"c",1],[11,20,"c",4],[11,4,"c",4],[11,6,"c",4],[11,1,"c",2],
  [9,10,"c",1],[9,11,"c",2],[9,7,"c",2],[9,12,"c",1],[9,3,"c",3],[9,13,"c",1],[9,14,"c",1],[9,15,"c",5],[9,16,"c",3],[9,17,"c",1],[9,2,"c",4],[9,0,"c",4],[9,18,"c",2],[9,5,"c",3],[9,19,"c",4],[9,8,"c",3],[9,20,"c",3],[9,4,"c",4],[9,6,"c",2],[9,1,"c",3],
  [5,9,"c",1],[5,10,"c",2],[5,11,"c",3],[5,7,"c",3],[5,12,"c",2],[5,3,"c",3],[5,13,"c",3],[5,14,"c",2],[5,15,"c",1],[5,16,"c",2],[5,17,"c",2],[5,2,"c",3],[5,0,"c",3],[5,18,"c",1],[5,19,"c",2],[5,8,"c",3],[5,20,"c",2],[5,4,"c",4],[5,6,"c",2],[5,1,"c",3],
  [1,9,"c",2],[1,10,"c",2],[1,11,"c",2],[1,7,"c",3],[1,12,"c",3],[1,3,"c",4],[1,13,"c",2],[1,14,"c",2],[1,15,"c",2],[1,16,"c",3],[1,17,"c",2],[1,2,"c",4],[1,0,"c",5],[1,18,"c",4],[1,5,"c",3],[1,19,"c",2],[1,8,"c",4],[1,20,"c",3],[1,4,"c",4],[1,6,"c",3],
  [17,10,"c",4],[17,11,"c",4],[17,7,"c",4],[17,12,"c",4],[17,3,"c",3],[17,13,"c",3],[17,9,"c",3],[17,14,"c",4],[17,15,"c",3],[17,16,"c",4],[17,2,"c",3],[17,0,"c",3],[17,18,"c",3],[17,5,"c",3],[17,19,"c",3],[17,8,"c",3],[17,20,"c",4],[17,4,"c",4],[17,6,"c",4],[17,1,"c",3],
  [13,9,"c",1],[13,10,"c",1],[13,11,"c",3],[13,7,"c",3],[13,12,"c",3],[13,3,"c",1],[13,14,"c",1],[13,15,"c",1],[13,16,"c",3],[13,17,"c",1],[13,2,"c",3],[13,0,"c",3],[13,18,"c",1],[13,5,"c",5],[13,19,"c",1],[13,8,"c",1],[13,20,"c",3],[13,4,"c",5],[13,6,"c",3],[13,1,"c",4],
  [20,10,"c",3],[20,11,"c",3],[20,9,"c",3],[20,7,"c",3],[20,12,"c",3],[20,3,"c",3],[20,13,"c",3],[20,14,"c",3],[20,15,"c",3],[20,16,"c",3],[20,17,"c",3],[20,2,"c",3],[20,0,"c",3],[20,18,"c",3],[20,5,"c",3],[20,19,"c",3],[20,8,"c",3],[20,4,"c",3],[20,6,"c",3],[20,1,"c",3],
  // Avoidance
  [5,12,"v",1],[17,11,"v",1],[12,4,"v",1],[11,6,"v",1],[7,9,"v",1],[16,6,"v",1],[8,0,"v",1],[7,15,"v",1],[10,5,"v",1],[13,19,"v",1],[19,1,"v",1],[0,18,"v",1],[9,4,"v",1],[14,9,"v",1],[3,10,"v",1],[1,8,"v",1],[6,7,"v",1],[11,0,"v",1],[0,3,"v",1],[16,4,"v",1],[16,0,"v",1],[20,4,"v",1],[16,19,"v",1],[4,8,"v",1],[2,8,"v",1],[7,19,"v",1],[15,4,"v",1],
  // Advice-seeking
  [17,18,"d",1],[9,15,"d",1],[1,18,"d",1],[19,9,"d",1],[20,1,"d",1],[14,4,"d",1],[0,1,"d",1],[19,2,"d",1],[19,15,"d",1],[4,18,"d",1],[1,4,"d",1],[12,4,"d",1],[16,8,"d",1],[11,5,"d",1],[1,0,"d",1],[10,1,"d",1],[20,8,"d",1],[6,1,"d",1],[0,5,"d",1],[7,20,"d",1],[17,4,"d",1],[13,4,"d",1],[8,4,"d",1],[20,5,"d",1],[11,18,"d",1],[6,8,"d",1],[3,4,"d",1],[11,7,"d",1],[6,5,"d",1],[2,4,"d",1],[15,1,"d",1],[7,5,"d",1],[13,0,"d",1],[16,18,"d",1],[12,10,"d",1],[2,0,"d",1],[3,0,"d",1],[16,7,"d",1],[15,9,"d",1],[9,4,"d",1],[5,4,"d",1],[16,11,"d",1],[19,3,"d",1],[11,4,"d",1],[7,18,"d",1],[10,18,"d",1],[19,0,"d",1],[6,7,"d",1],[10,7,"d",1],[16,4,"d",1],[14,5,"d",1],[9,19,"d",1],[0,4,"d",1],[1,5,"d",1],[13,1,"d",1],[2,1,"d",1],[20,4,"d",1],[7,11,"d",1],[3,1,"d",1],[13,2,"d",1],[12,14,"d",1],[6,4,"d",1],[7,4,"d",1],[17,5,"d",1],[10,4,"d",1],[13,5,"d",1],[2,8,"d",1],[11,16,"d",1],[3,2,"d",1],[3,8,"d",1],[10,0,"d",1],[9,1,"d",1],[12,7,"d",1],[4,5,"d",1],[9,20,"d",1],[15,4,"d",1],
]

const rScale = (id: number) => 11 + ((INDEGREE[id]-39)/(71-39))*13

export default function SociogramPage() {
  const svgRef       = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef       = useRef<any>(null)
  const zoomRef      = useRef<any>(null)
  const svgSel       = useRef<any>(null)
  const pinnedRef    = useRef<Set<number>>(new Set())

  const [layers,    setLayers]    = useState<Record<EType,boolean>>({c:true,v:true,d:true})
  const [minScore,  setMinScore]  = useState(2)
  const [focusNode, setFocusNode] = useState<number|null>(null)
  const [search,    setSearch]    = useState('')
  const [tooltip,   setTooltip]   = useState<{x:number;y:number;id:number}|null>(null)
  const [d3Loaded,  setD3Loaded]  = useState(false)
  const [settled,   setSettled]   = useState(false)
  const [showLabels,setShowLabels]= useState(true)
  const [deptFilter,setDeptFilter]= useState<Set<string>>(new Set(Object.keys(DEPT_COLORS)))
  const [fullscreen,setFullscreen]= useState(false)

  const stateRef = useRef({layers,minScore,focusNode,search,showLabels,deptFilter})
  stateRef.current = {layers,minScore,focusNode,search,showLabels,deptFilter}

  useEffect(()=>{
    if((window as any).d3){setD3Loaded(true);return}
    const s=document.createElement('script')
    s.src='https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js'
    s.onload=()=>setD3Loaded(true)
    document.head.appendChild(s)
  },[])

  useEffect(()=>{ if(d3Loaded) buildViz(); return ()=>simRef.current?.stop() },[d3Loaded])
  useEffect(()=>{ applyFilters() },[layers,minScore,focusNode,search,showLabels,deptFilter])

  const applyFilters = useCallback(()=>{
    const d3=(window as any).d3; if(!d3||!svgSel.current) return
    const {layers:L,minScore:ms,focusNode:fn,search:sq,showLabels:sl,deptFilter:df}=stateRef.current
    const lq=sq.toLowerCase()

    svgSel.current.selectAll('.edge').each(function(d:any){
      const sid=(d.source as any).id, tid=(d.target as any).id
      const show = L[d.type as EType] &&
        (d.type!=='c'||d.score>=ms) &&
        (fn===null||sid===fn||tid===fn) &&
        df.has(NODES[sid].dept) && df.has(NODES[tid].dept)
      d3.select(this).style('display',show?null:'none')
    })

    svgSel.current.selectAll('.node-g').each(function(d:any){
      const nameMatch=!lq||(d.name as string).toLowerCase().includes(lq)
      const deptShow=df.has(NODES[d.id].dept)
      const focusDim=fn!==null&&d.id!==fn&&!EDGES.some(e=>(e[0]===fn&&e[1]===d.id)||(e[1]===fn&&e[0]===d.id))
      const dim=focusDim||(lq&&!nameMatch)||!deptShow
      d3.select(this).attr('opacity',dim?0.12:1)
    })

    svgSel.current.selectAll('.node-label').style('display',sl?null:'none')
  },[])

  function buildViz(){
    const d3=(window as any).d3
    if(!d3||!svgRef.current||!containerRef.current) return
    const W=containerRef.current.clientWidth||900
    const H=containerRef.current.clientHeight||680

    d3.select(svgRef.current).selectAll('*').remove()
    const svg=d3.select(svgRef.current).attr('width',W).attr('height',H)
    svgSel.current=svg

    // ── Defs ─────────────────────────────────────────────────────────────────
    const defs=svg.append('defs')

    // Subtle drop shadow for nodes
    const sh=defs.append('filter').attr('id','nshadow').attr('x','-30%').attr('y','-30%').attr('width','160%').attr('height','160%')
    sh.append('feDropShadow').attr('dx',0).attr('dy',1.5).attr('stdDeviation',3).attr('flood-color','rgba(0,0,0,0.18)')

    // Arrow markers — one per edge type, visible on light bg
    Object.entries(EDGE_CFG).forEach(([type,cfg])=>{
      [1,2,3,4,5].forEach(s=>{
        defs.append('marker')
          .attr('id',`ar-${type}-${s}`)
          .attr('viewBox','0 -4 8 8').attr('refX',16).attr('refY',0)
          .attr('markerWidth',4+s*0.35).attr('markerHeight',4+s*0.35)
          .attr('orient','auto')
          .append('path').attr('d','M0,-4L8,0L0,4')
          .attr('fill',cfg.color).attr('opacity',0.85)
      })
    })

    // Node radial gradients
    NODES.forEach(n=>{
      const col=DEPT_COLORS[n.dept]
      const g=defs.append('radialGradient').attr('id',`gr-${n.id}`).attr('cx','38%').attr('cy','35%').attr('r','65%')
      g.append('stop').attr('offset','0%').attr('stop-color','#fff').attr('stop-opacity',0.9)
      g.append('stop').attr('offset','50%').attr('stop-color',col).attr('stop-opacity',0.92)
      g.append('stop').attr('offset','100%').attr('stop-color',col)
    })

    // ── Canvas background ─────────────────────────────────────────────────────
    svg.append('rect').attr('width',W).attr('height',H).attr('fill','#F5F0E8')

    // ── Zoom/pan ──────────────────────────────────────────────────────────────
    const g=svg.append('g').attr('class','root-g')
    const zoom=d3.zoom().scaleExtent([0.1,5])
      .on('zoom',(ev:any)=>g.attr('transform',ev.transform))
    zoomRef.current=zoom
    svg.call(zoom)

    // ── D3 data ───────────────────────────────────────────────────────────────
    const nodes:any[]=NODES.map(n=>({...n}))
    const links:any[]=EDGES.map(([s,t,type,score])=>({source:s,target:t,type,score,...EDGE_CFG[type]}))

    // ── Edges ─────────────────────────────────────────────────────────────────
    const edgeG=g.append('g')
    const edge=edgeG.selectAll('line').data(links).join('line')
      .attr('class','edge')
      .attr('stroke',(d:any)=>d.color)
      .attr('stroke-width',(d:any)=>d.type==='v'?1.8:Math.max(0.6,d.score*0.55))
      .attr('stroke-opacity',(d:any)=>d.type==='v'?0.85:d.type==='d'?0.6:0.2+d.score*0.1)
      .attr('stroke-dasharray',(d:any)=>d.dash||null)
      .attr('marker-end',(d:any)=>`url(#ar-${d.type}-${d.score})`)

    // ── Nodes ─────────────────────────────────────────────────────────────────
    const nodeG=g.append('g')
    let clickTimer:any=null

    const node=nodeG.selectAll('g').data(nodes).join('g')
      .attr('class','node-g')
      .style('cursor','pointer')
      .call(
        d3.drag()
          .on('start',(ev:any,d:any)=>{
            // Very low alpha restart — barely disturbs other nodes
            if(!ev.active) simRef.current?.alphaTarget(0.02).restart()
            d.fx=d.x; d.fy=d.y
          })
          .on('drag',(ev:any,d:any)=>{ d.fx=ev.x; d.fy=ev.y })
          .on('end',(ev:any,d:any)=>{
            if(!ev.active) simRef.current?.alphaTarget(0)
            // If pinned, keep fixed; otherwise release
            if(!pinnedRef.current.has(d.id)){ d.fx=null; d.fy=null }
          })
      )
      // Single click → focus
      .on('click',(_ev:any,d:any)=>{
        clearTimeout(clickTimer)
        clickTimer=setTimeout(()=>setFocusNode((p:any)=>p===d.id?null:d.id),180)
      })
      // Double-click → pin/unpin
      .on('dblclick',(_ev:any,d:any)=>{
        clearTimeout(clickTimer)
        const d3=((window as any).d3)
        if(pinnedRef.current.has(d.id)){
          pinnedRef.current.delete(d.id)
          d.fx=null; d.fy=null
          d3.select(_ev.currentTarget).select('.pin-dot').attr('display','none')
        } else {
          pinnedRef.current.add(d.id)
          d.fx=d.x; d.fy=d.y
          d3.select(_ev.currentTarget).select('.pin-dot').attr('display',null)
        }
      })
      .on('mouseenter',(ev:any,d:any)=>{
        const r=containerRef.current!.getBoundingClientRect()
        setTooltip({x:ev.clientX-r.left+14,y:ev.clientY-r.top-10,id:d.id})
      })
      .on('mousemove',(ev:any)=>{
        const r=containerRef.current!.getBoundingClientRect()
        setTooltip(p=>p?{...p,x:ev.clientX-r.left+14,y:ev.clientY-r.top-10}:null)
      })
      .on('mouseleave',()=>setTooltip(null))

    // White card backing + shadow
    node.append('circle')
      .attr('r',(d:any)=>rScale(d.id)+2)
      .attr('fill','#F5F0E8')
      .attr('stroke','none')
      .attr('filter','url(#nshadow)')

    // Dept color ring
    node.append('circle')
      .attr('r',(d:any)=>rScale(d.id)+1.5)
      .attr('fill','none')
      .attr('stroke',(d:any)=>DEPT_COLORS[d.dept])
      .attr('stroke-width',2)
      .attr('opacity',0.6)

    // Main filled circle
    node.append('circle')
      .attr('r',(d:any)=>rScale(d.id))
      .attr('fill',(d:any)=>`url(#gr-${d.id})`)

    // Person silhouette — minimalistic: head circle + shoulder arc in white
    node.each(function(d:any){
      const sel=(window as any).d3.select(this)
      const r=rScale(d.id)
      const hR=r*0.3, hY=-r*0.16
      // head
      sel.append('circle').attr('cx',0).attr('cy',hY).attr('r',hR)
        .attr('fill','rgba(255,255,255,0.92)').attr('stroke','none')
      // shoulders
      const sw=r*0.72, sy=r*0.28
      sel.append('path')
        .attr('d',`M${-sw},${sy+r*0.35} Q${-sw},${sy} 0,${sy} Q${sw},${sy} ${sw},${sy+r*0.35}`)
        .attr('fill','rgba(255,255,255,0.82)')
    })

    // Pin indicator dot (hidden by default)
    node.append('circle').attr('class','pin-dot')
      .attr('cx',(d:any)=>rScale(d.id)*0.65).attr('cy',(d:any)=>-rScale(d.id)*0.65)
      .attr('r',3.5).attr('fill','#F4A261').attr('stroke','white').attr('stroke-width',1)
      .attr('display','none')

    // Name label
    node.append('text').attr('class','node-label')
      .text((d:any)=>{ const p=d.name.split(' '); return rScale(d.id)>=20?p.slice(0,2).join(' '):p[0] })
      .attr('text-anchor','middle')
      .attr('y',(d:any)=>rScale(d.id)+13)
      .attr('font-size','9.5px').attr('font-weight','700')
      .attr('font-family','Plus Jakarta Sans, sans-serif')
      .attr('fill','#3D3028').attr('pointer-events','none')

    // ── Simulation — settle quickly then stop ─────────────────────────────────
    const sim=d3.forceSimulation(nodes)
      .force('link',d3.forceLink(links).id((d:any)=>d.id).distance(95).strength(0.22))
      .force('charge',d3.forceManyBody().strength(-450))
      .force('center',d3.forceCenter(W/2,H/2).strength(0.04))
      .force('collision',d3.forceCollide().radius((d:any)=>rScale(d.id)+10))
      .alphaDecay(0.04)       // settles in ~120 ticks
      .velocityDecay(0.55)    // heavy damping = no bouncing

    simRef.current=sim

    let tc=0
    sim.on('tick',()=>{
      tc++; if(tc%2!==0) return
      edge.attr('x1',(d:any)=>d.source.x).attr('y1',(d:any)=>d.source.y)
          .attr('x2',(d:any)=>d.target.x).attr('y2',(d:any)=>d.target.y)
      node.attr('transform',(d:any)=>`translate(${d.x},${d.y})`)
    })

    sim.on('end',()=>{
      // Freeze all positions so dragging one node doesn't bounce others
      nodes.forEach(n=>{ n.fx=n.x; n.fy=n.y })
      sim.stop()
      setSettled(true)
    })

    setTimeout(applyFilters,80)
  }

  const zoomBy=(k:number)=>{
    const d3=(window as any).d3; if(!d3||!svgRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy,k)
  }
  const zoomFit=()=>{
    const d3=(window as any).d3; if(!d3||!svgRef.current) return
    d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform,d3.zoomIdentity)
  }

  const exportPNG=()=>{
    const svg=svgRef.current; if(!svg) return
    const s=new XMLSerializer().serializeToString(svg)
    const blob=new Blob([s],{type:'image/svg+xml'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url; a.download='sociogram.svg'; a.click()
    URL.revokeObjectURL(url)
  }

  const toggleDept=(d:string)=>setDeptFilter(p=>{
    const n=new Set(p); n.has(d)?n.delete(d):n.add(d); return n
  })

  const tipNode = tooltip ? NODES[tooltip.id] : null
  const topNodes=[...NODES].sort((a,b)=>INDEGREE[b.id]-INDEGREE[a.id]).slice(0,5)

  return (
    <div className={`flex bg-[#F5F0E8] text-[#3D3028] ${fullscreen?'fixed inset-0 z-50':'h-screen'}`}>

      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div className="w-60 flex-shrink-0 bg-white border-r border-[#E8E0D5] flex flex-col overflow-y-auto">
        <div className="px-4 py-4 border-b border-[#E8E0D5]">
          <p className="text-[10px] font-bold text-[#2D6A4F] uppercase tracking-widest mb-0.5">Sociogram</p>
          <h1 className="text-sm font-bold text-[#3D3028]" style={{fontFamily:'Fraunces,serif'}}>
            Workplace Network
          </h1>
          <p className="text-[10px] text-[#8B7355] mt-0.5">21 participants · stress360</p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#E8E0D5]">
          <div className="relative">
            <span className="absolute left-2.5 top-1.5 text-[#8B7355] text-xs pointer-events-none">⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find person…"
              className="w-full bg-[#F5F0E8] border border-[#DDD6CC] rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-[#3D3028] placeholder-[#B5A898] focus:outline-none focus:border-[#2D6A4F] transition-colors"/>
            {search&&<button onClick={()=>setSearch('')} className="absolute right-2.5 top-1.5 text-[#8B7355] text-[10px]">✕</button>}
          </div>
        </div>

        {/* Relationship layers */}
        <div className="px-4 py-3 border-b border-[#E8E0D5]">
          <p className="text-[9px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">Relationships</p>
          {(Object.entries(EDGE_CFG) as [EType,typeof EDGE_CFG.c][]).map(([k,cfg])=>(
            <button key={k} onClick={()=>setLayers(p=>({...p,[k]:!p[k]}))}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] mb-1.5 border transition-all ${layers[k]?'text-[#3D3028]':'text-[#B5A898] border-[#E8E0D5]'}`}
              style={layers[k]?{backgroundColor:cfg.color+'15',borderColor:cfg.color+'55'}:{}}>
              <span className="w-7 h-1.5 rounded-full flex-shrink-0"
                style={{background:layers[k]?cfg.color:'#DDD6CC',
                  backgroundImage:cfg.dash&&layers[k]?`repeating-linear-gradient(90deg,${cfg.color} 0 4px,transparent 4px 7px)`:undefined,
                  backgroundSize:cfg.dash?'auto':undefined}}/>
              <span className="font-semibold">{cfg.label}</span>
              <span className="ml-auto text-[9px] opacity-40">{k==='c'?'400':k==='v'?'27':'76'}</span>
            </button>
          ))}

          {/* Min comm strength */}
          <div className="mt-3 px-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[9px] font-semibold text-[#8B7355] uppercase tracking-wider">Min. strength</p>
              <span className="text-[10px] font-bold text-[#2D6A4F]">{minScore}/5</span>
            </div>
            <input type="range" min={1} max={5} value={minScore} onChange={e=>setMinScore(+e.target.value)}
              className="w-full h-1.5 rounded-full appearance-none bg-[#E8E0D5]"
              style={{accentColor:'#2D6A4F'}}/>
            <p className="text-[9px] text-[#8B7355] mt-1">
              {EDGES.filter(e=>e[2]!=='c'||e[3]>=minScore).length} of {EDGES.length} edges shown
            </p>
          </div>
        </div>

        {/* Department filter */}
        <div className="px-4 py-3 border-b border-[#E8E0D5]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold text-[#8B7355] uppercase tracking-wider">Groups</p>
            <button onClick={()=>setDeptFilter(deptFilter.size===Object.keys(DEPT_COLORS).length?new Set():new Set(Object.keys(DEPT_COLORS)))}
              className="text-[9px] text-[#2D6A4F] font-semibold hover:underline">
              {deptFilter.size===Object.keys(DEPT_COLORS).length?'None':'All'}
            </button>
          </div>
          {Object.entries(DEPT_COLORS).map(([dept,color])=>(
            <button key={dept} onClick={()=>toggleDept(dept)}
              className={`w-full flex items-center gap-2 py-1.5 px-1 rounded-lg transition-all ${deptFilter.has(dept)?'opacity-100':'opacity-35'}`}>
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 transition-all" style={{background:color}}/>
              <span className="text-[11px] font-medium text-[#3D3028] flex-1 text-left">{dept}</span>
              <span className="text-[9px] text-[#8B7355]">{NODES.filter(n=>n.dept===dept).length}</span>
            </button>
          ))}
        </div>

        {/* Top nodes */}
        <div className="px-4 py-3 border-b border-[#E8E0D5]">
          <p className="text-[9px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">Most Connected</p>
          {topNodes.map((n,i)=>(
            <button key={n.id} onClick={()=>setFocusNode(p=>p===n.id?null:n.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] mb-1 transition-all ${focusNode===n.id?'bg-[#EDF7F2]':' hover:bg-[#FAF8F4]'}`}>
              <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-black text-white"
                style={{background:DEPT_COLORS[n.dept]}}>{i+1}</span>
              <span className="flex-1 font-medium text-[#3D3028] truncate text-left">{n.name}</span>
              <span className="text-[9px] font-semibold" style={{color:DEPT_COLORS[n.dept]}}>{INDEGREE[n.id]}</span>
            </button>
          ))}
        </div>

        {/* View options */}
        <div className="px-4 py-3">
          <p className="text-[9px] font-bold text-[#8B7355] uppercase tracking-wider mb-2">View</p>
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <div onClick={()=>setShowLabels(p=>!p)}
              className={`w-8 h-4 rounded-full transition-colors relative ${showLabels?'bg-[#2D6A4F]':'bg-[#DDD6CC]'}`}>
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${showLabels?'left-4.5':'left-0.5'}`}
                style={{left:showLabels?18:2}}/>
            </div>
            <span className="text-[11px] text-[#3D3028] font-medium">Show name labels</span>
          </label>
          <p className="text-[9px] text-[#8B7355] mt-2">Double-click a node to pin it</p>
          <p className="text-[9px] text-[#8B7355]">Click to focus · Scroll to zoom</p>
        </div>

        {/* Footer note */}
        <div className="mt-auto px-4 py-3 border-t border-[#E8E0D5]">
          <p className="text-[9px] text-[#B5A898] leading-relaxed">
            © 2026 Crazy Sapiens — Syed, Sharma & Poddar
          </p>
        </div>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full"/>

        {/* Top right controls */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center bg-white border border-[#E8E0D5] rounded-xl shadow-sm overflow-hidden">
            <button onClick={()=>zoomBy(1.35)} className="w-8 h-8 flex items-center justify-center text-[#8B7355] hover:bg-[#F5F0E8] hover:text-[#2D6A4F] transition-all text-base">+</button>
            <div className="w-px h-5 bg-[#E8E0D5]"/>
            <button onClick={zoomFit} className="px-2.5 h-8 text-[9px] font-bold text-[#8B7355] hover:bg-[#F5F0E8] hover:text-[#2D6A4F] transition-all tracking-wider">FIT</button>
            <div className="w-px h-5 bg-[#E8E0D5]"/>
            <button onClick={()=>zoomBy(0.74)} className="w-8 h-8 flex items-center justify-center text-[#8B7355] hover:bg-[#F5F0E8] hover:text-[#2D6A4F] transition-all text-base">−</button>
          </div>
          {/* Export */}
          <button onClick={exportPNG} title="Export SVG"
            className="w-8 h-8 bg-white border border-[#E8E0D5] rounded-xl shadow-sm text-[#8B7355] hover:text-[#2D6A4F] hover:border-[#2D6A4F]/40 transition-all flex items-center justify-center text-xs">
            ↓
          </button>
          {/* Fullscreen */}
          <button onClick={()=>setFullscreen(p=>!p)}
            className="w-8 h-8 bg-white border border-[#E8E0D5] rounded-xl shadow-sm text-[#8B7355] hover:text-[#2D6A4F] hover:border-[#2D6A4F]/40 transition-all flex items-center justify-center text-xs">
            {fullscreen?'⊠':'⊡'}
          </button>
        </div>

        {/* Top left status */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur border border-[#E8E0D5] rounded-lg px-2.5 py-1.5 shadow-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${settled?'bg-[#2D6A4F]':'bg-[#F4A261]'}`}/>
            <span className="text-[9px] text-[#8B7355]">
              {settled?'Layout ready':'Computing layout…'}
            </span>
          </div>
          {focusNode!==null&&(
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur border border-[#2D6A4F]/30 rounded-lg px-2.5 py-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full" style={{background:DEPT_COLORS[NODES[focusNode].dept]}}/>
              <span className="text-[9px] font-semibold text-[#2D6A4F]">{NODES[focusNode].name}</span>
              <button onClick={()=>setFocusNode(null)} className="text-[9px] text-[#8B7355] hover:text-[#3D3028] ml-0.5">✕</button>
            </div>
          )}
        </div>

        {/* Legend strip — bottom left */}
        <div className="absolute bottom-4 left-4">
          <div className="bg-white/85 backdrop-blur border border-[#E8E0D5] rounded-xl px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[8px] font-bold text-[#8B7355] uppercase tracking-wider mb-1.5">Node size</p>
                <div className="flex items-center gap-1.5">
                  {[8,12,16,20,24].map(s=>(
                    <div key={s} className="rounded-full bg-[#2D6A4F] opacity-60" style={{width:s/3*2,height:s/3*2}}/>
                  ))}
                  <span className="text-[9px] text-[#8B7355] ml-1">= centrality</span>
                </div>
              </div>
              <div className="w-px h-8 bg-[#E8E0D5]"/>
              <div>
                <p className="text-[8px] font-bold text-[#8B7355] uppercase tracking-wider mb-1.5">Line weight</p>
                <div className="flex items-center gap-2">
                  {[1,2,3].map(s=>(
                    <div key={s} className="bg-[#2D6A4F] opacity-60 rounded" style={{width:16,height:s*1.5}}/>
                  ))}
                  <span className="text-[9px] text-[#8B7355] ml-1">= tie strength</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip&&tipNode&&(
          <div className="absolute z-40 pointer-events-none" style={{left:tooltip.x,top:tooltip.y}}>
            <div className="bg-white border border-[#E8E0D5] rounded-2xl p-4 shadow-xl min-w-[200px]"
              style={{borderLeftColor:DEPT_COLORS[tipNode.dept],borderLeftWidth:3}}>
              {/* Header with person avatar */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex-shrink-0 relative overflow-hidden"
                  style={{background:DEPT_COLORS[tipNode.dept]}}>
                  <svg viewBox="0 0 40 40" className="w-full h-full absolute inset-0">
                    <circle cx="20" cy="14" r="7" fill="rgba(255,255,255,0.9)"/>
                    <path d="M4 40 Q4 27 20 27 Q36 27 36 40" fill="rgba(255,255,255,0.8)"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#3D3028]">{tipNode.name}</p>
                  <p className="text-[10px] font-semibold" style={{color:DEPT_COLORS[tipNode.dept]}}>{tipNode.dept}</p>
                  <p className="text-[9px] text-[#8B7355]">{tipNode.role}</p>
                </div>
              </div>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[
                  {l:'In-degree',  v:INDEGREE[tipNode.id],        c:'#2D6A4F'},
                  {l:'Avoidance',  v:EDGES.filter(e=>e[2]==='v'&&(e[0]===tipNode.id||e[1]===tipNode.id)).length, c:'#C0392B'},
                  {l:'Advice',     v:EDGES.filter(e=>e[2]==='d'&&(e[0]===tipNode.id||e[1]===tipNode.id)).length, c:'#B7770D'},
                ].map(s=>(
                  <div key={s.l} className="bg-[#FAF8F4] rounded-lg p-2 text-center">
                    <p className="text-sm font-black" style={{color:s.c}}>{s.v}</p>
                    <p className="text-[8px] text-[#8B7355] leading-tight mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>
              {/* Mutual ties indicator */}
              {focusNode!==null&&focusNode!==tipNode.id&&(()=>{
                const out=EDGES.some(e=>e[0]===focusNode&&e[1]===tipNode.id&&e[2]==='c')
                const inn=EDGES.some(e=>e[1]===focusNode&&e[0]===tipNode.id&&e[2]==='c')
                if(!out&&!inn) return null
                return (
                  <div className="bg-[#EDF7F2] rounded-lg px-2.5 py-1.5 text-[9px] text-[#2D6A4F] font-semibold">
                    {out&&inn?'↕ Mutual communication':out?'→ You communicate with them':'← They communicate with you'}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}