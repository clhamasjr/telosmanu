import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ACCENT, FONT } from '../lib/constants'
import { useViewport } from '../hooks/useData'
import { S, Modal, Loading, fmtDate } from '../components/UI'
import { useUser } from '../App'

const STATUS_COLORS = {
  'Operando': { bg: '#F0FDF4', border: '#86EFAC', dot: '#22C55E', text: '#166534' },
  'Parado': { bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444', text: '#991B1B' },
  'Em Manutenção': { bg: '#EFF6FF', border: '#93C5FD', dot: '#3B82F6', text: '#1E40AF' },
  'Com Interferência': { bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', text: '#92400E' },
  'Desativado': { bg: '#F8FAFC', border: '#E2E8F0', dot: '#94A3B8', text: '#64748B' },
}

const AREA_COLORS = [
  '#3B82F6','#EF4444','#22C55E','#F59E0B','#8B5CF6',
  '#EC4899','#14B8A6','#F97316','#6366F1','#06B6D4',
  '#84CC16','#D946EF','#0EA5E9','#10B981','#E11D48',
]

const GS = 20
const snap = v => Math.round(v / GS) * GS

export default function MapaFabrica() {
  const vp = useViewport()
  const { perfil } = useUser()
  const canEdit = ['admin','gestor'].includes(perfil)

  const [areas, setAreas] = useState([])
  const [equips, setEquips] = useState([])
  const [osCount, setOsCount] = useState({})
  const [loading, setLoading] = useState(true)
  const [pos, setPos] = useState({})
  const [sz, setSz] = useState({})
  const [drag, setDrag] = useState(null)
  const [resize, setResize] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [selEquip, setSelEquip] = useState(null)
  const [eqOS, setEqOS] = useState([])
  const [loadOS, setLoadOS] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPan, setIsPan] = useState(false)
  const [panS, setPanS] = useState(null)
  const [legend, setLegend] = useState(true)
  const cRef = useRef(null)
  const svgRef = useRef(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [{ data: a }, { data: e }] = await Promise.all([
        supabase.from('areas').select('*').order('nome'),
        supabase.from('equipamentos').select('*').order('nome'),
      ])
      setAreas(a || []); setEquips(e || [])
      const { data: openOS } = await supabase.from('ordens_servico')
        .select('equipamento_id,status_os!inner(nome)')
        .in('status_os.nome', ['Aberta','Em Andamento','Aguardando Peça','Aguardando Aprovação'])
      const ct = {}
      ;(openOS||[]).forEach(o => { ct[o.equipamento_id] = (ct[o.equipamento_id]||0)+1 })
      setOsCount(ct)
      try {
        const sp = JSON.parse(localStorage.getItem('telos_map_pos') || '{}')
        const ss = JSON.parse(localStorage.getItem('telos_map_sz') || '{}')
        if (Object.keys(sp).length > 0) { setPos(sp); setSz(ss) }
        else { autoLayout(a||[], e||[]) }
      } catch { autoLayout(a||[], e||[]) }
      setLoading(false)
    })()
  }, [])

  const autoLayout = (a, e) => {
    const cols = Math.max(2, Math.ceil(Math.sqrt(a.length)))
    const p = {}, s = {}
    a.forEach((ar, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      const eqC = e.filter(eq => eq.area_id === ar.id).length
      const w = Math.max(260, Math.min(440, 120 + eqC * 58))
      const h = Math.max(160, 90 + Math.ceil(eqC / Math.max(1, Math.floor((w-16)/56))) * 62)
      p[ar.id] = { x: 40 + col * (w + 40), y: 40 + row * (h + 40) }
      s[ar.id] = { w, h }
    })
    setPos(p); setSz(s)
  }

  const save = useCallback(() => {
    localStorage.setItem('telos_map_pos', JSON.stringify(pos))
    localStorage.setItem('telos_map_sz', JSON.stringify(sz))
  }, [pos, sz])

  const onDragStart = (id, e) => {
    if (!editMode||!canEdit) return; e.stopPropagation()
    const p = pos[id] || { x: 0, y: 0 }
    setDrag({ id, ox: e.clientX/zoom - p.x, oy: e.clientY/zoom - p.y })
  }
  const onResizeStart = (id, e) => {
    if (!editMode||!canEdit) return; e.stopPropagation()
    const s = sz[id] || { w: 300, h: 200 }
    setResize({ id, sx: e.clientX, sy: e.clientY, sw: s.w, sh: s.h })
  }

  const onMM = e => {
    if (drag) {
      const x = snap(e.clientX/zoom - drag.ox - pan.x/zoom)
      const y = snap(e.clientY/zoom - drag.oy - pan.y/zoom)
      setPos(p => ({ ...p, [drag.id]: { x: Math.max(0,x), y: Math.max(0,y) } }))
    } else if (resize) {
      const dw = (e.clientX - resize.sx)/zoom, dh = (e.clientY - resize.sy)/zoom
      setSz(s => ({ ...s, [resize.id]: { w: snap(Math.max(200, resize.sw+dw)), h: snap(Math.max(120, resize.sh+dh)) } }))
    } else if (isPan && panS) {
      setPan({ x: e.clientX - panS.x, y: e.clientY - panS.y })
    }
  }
  const onMU = () => {
    if (drag||resize) save()
    setDrag(null); setResize(null); setIsPan(false); setPanS(null)
  }
  const onPanStart = e => {
    if (editMode || (e.target !== svgRef.current && e.target.tagName === 'rect' && e.target.getAttribute('data-bg') !== 'true')) return
    setIsPan(true); setPanS({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const openDetail = async eq => {
    setSelEquip(eq); setLoadOS(true)
    const { data: os } = await supabase.from('ordens_servico')
      .select('id,numero_ordem,titulo,data_abertura,status_os(nome,icone,cor),tipos_manutencao(nome)')
      .eq('equipamento_id', eq.id).order('data_abertura',{ascending:false}).limit(20)
    setEqOS(os||[]); setLoadOS(false)
  }

  const mx = Math.max(1200, ...Object.entries(pos).map(([id,p]) => p.x+(sz[id]?.w||300)+60))
  const my = Math.max(800, ...Object.entries(pos).map(([id,p]) => p.y+(sz[id]?.h||200)+60))

  if (loading) return <Loading/>

  return <div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
      <div>
        <h1 style={{ margin:0, fontSize:vp.isMobile?22:28, fontWeight:800, color:'#0F172A' }}>🗺️ Mapa da Fábrica</h1>
        <p style={{ margin:'4px 0 0', fontSize:12, color:'#64748B' }}>{areas.length} áreas · {equips.length} equipamentos</p>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:2, background:'#F1F5F9', borderRadius:8, border:'1px solid #E2E8F0' }}>
          <ZB onClick={() => setZoom(z=>Math.max(.3,z-.1))}>−</ZB>
          <span style={{ padding:'6px 8px', fontSize:11, color:'#64748B', minWidth:40, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
          <ZB onClick={() => setZoom(z=>Math.min(2,z+.1))}>+</ZB>
          <ZB onClick={() => { setZoom(1); setPan({x:0,y:0}) }}>↺</ZB>
        </div>
        <button onClick={() => setLegend(v=>!v)} style={{...S.btnS,padding:'6px 12px',fontSize:11}}>🏷️</button>
        {canEdit && <button onClick={() => { if(editMode) save(); setEditMode(v=>!v) }}
          style={{...(editMode?S.btnP:S.btnS),padding:'6px 14px',fontSize:12}}>
          {editMode?'💾 Salvar Layout':'✏️ Editar Mapa'}
        </button>}
      </div>
    </div>

    {legend && <div style={{ display:'flex', gap:12, marginBottom:12, flexWrap:'wrap', padding:'8px 14px', background:'#FFF', borderRadius:10, border:'1px solid #E2E8F0' }}>
      {Object.entries(STATUS_COLORS).map(([n,c]) => <div key={n} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#475569' }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:c.dot }}/>{n}
      </div>)}
      <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#475569' }}>
        <span style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:4, padding:'0 4px', fontSize:9, color:'#EF4444', fontWeight:700 }}>N</span>
        OS abertas
      </div>
    </div>}

    <div ref={cRef} style={{
      background:'#FFF', borderRadius:14, border:'1px solid #E2E8F0', overflow:'hidden',
      boxShadow:'0 1px 3px rgba(0,0,0,.04)', position:'relative',
      height: vp.isMobile ? 'calc(100vh - 260px)' : 'calc(100vh - 210px)',
      cursor: editMode?'default':isPan?'grabbing':'grab',
    }}>
      <svg ref={svgRef} style={{ width:'100%', height:'100%', display:'block' }}
        viewBox={`${-pan.x/zoom} ${-pan.y/zoom} ${(cRef.current?.clientWidth||1200)/zoom} ${(cRef.current?.clientHeight||800)/zoom}`}
        onMouseDown={onPanStart} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
      >
        <defs>
          <pattern id="grd" width={GS} height={GS} patternUnits="userSpaceOnUse">
            <circle cx={GS/2} cy={GS/2} r={.7} fill="#E2E8F0"/>
          </pattern>
        </defs>
        <rect data-bg="true" x={-pan.x/zoom-200} y={-pan.y/zoom-200} width={mx+400} height={my+400} fill="url(#grd)"/>

        {areas.map((area,idx) => {
          const p = pos[area.id]||{x:40,y:40}
          const s = sz[area.id]||{w:300,h:200}
          const aeq = equips.filter(e => e.area_id===area.id)
          const c = AREA_COLORS[idx%AREA_COLORS.length]
          const isD = drag?.id===area.id

          return <g key={area.id}>
            <rect x={p.x} y={p.y} width={s.w} height={s.h} rx={12} ry={12}
              fill="#FAFBFC" stroke={c+'50'} strokeWidth={isD?2.5:1.5}
              style={{filter:isD?'drop-shadow(0 4px 12px rgba(0,0,0,.1))':'drop-shadow(0 1px 2px rgba(0,0,0,.03))'}}/>
            <rect x={p.x} y={p.y} width={s.w} height={32} rx={12} ry={12} fill={c+'10'}/>
            <rect x={p.x} y={p.y+20} width={s.w} height={12} fill={c+'10'}/>
            <line x1={p.x} y1={p.y+32} x2={p.x+s.w} y2={p.y+32} stroke={c+'25'} strokeWidth={1}/>
            <text x={p.x+12} y={p.y+21} fontSize={12} fontWeight={700} fill={c} fontFamily={FONT} style={{pointerEvents:'none'}}>
              🏭 {area.nome}
            </text>
            <text x={p.x+s.w-10} y={p.y+21} fontSize={9} fill={c+'80'} fontFamily={FONT} textAnchor="end" style={{pointerEvents:'none'}}>
              {aeq.length} equip.
            </text>
            {editMode&&canEdit&&<rect x={p.x} y={p.y} width={s.w} height={32} fill="transparent" style={{cursor:'move'}} onMouseDown={e=>onDragStart(area.id,e)}/>}

            {aeq.map((eq,ei) => {
              const cols = Math.max(1, Math.floor((s.w-16)/56))
              const row = Math.floor(ei/cols), col = ei%cols
              const ex = p.x+10+col*56, ey = p.y+42+row*58
              const st = eq.status||'Operando'
              const sc = STATUS_COLORS[st]||STATUS_COLORS['Operando']
              const oc = osCount[eq.id]||0
              return <g key={eq.id} onClick={() => !editMode&&openDetail(eq)} style={{cursor:editMode?'default':'pointer'}}>
                <rect x={ex} y={ey} width={50} height={50} rx={8} ry={8} fill={sc.bg} stroke={sc.border} strokeWidth={1}/>
                <circle cx={ex+42} cy={ey+8} r={4} fill={sc.dot}/>
                <text x={ex+25} y={ey+22} fontSize={7.5} fontWeight={700} fill={sc.text} fontFamily={FONT} textAnchor="middle" style={{pointerEvents:'none'}}>
                  {(eq.codigo||'').substring(0,8)}
                </text>
                <text x={ex+25} y={ey+33} fontSize={5.5} fill="#64748B" fontFamily={FONT} textAnchor="middle" style={{pointerEvents:'none'}}>
                  {(eq.nome||'').substring(0,12)}
                </text>
                {oc>0&&<>
                  <rect x={ex-2} y={ey-2} width={16} height={14} rx={4} ry={4} fill="#FEF2F2" stroke="#FECACA" strokeWidth={.5}/>
                  <text x={ex+6} y={ey+8} fontSize={8} fontWeight={800} fill="#EF4444" fontFamily={FONT} textAnchor="middle" style={{pointerEvents:'none'}}>{oc}</text>
                </>}
                <title>{eq.codigo} - {eq.nome} ({st}){oc>0?` · ${oc} OS aberta(s)`:''}</title>
              </g>
            })}

            {editMode&&canEdit&&<g style={{cursor:'nwse-resize'}} onMouseDown={e=>onResizeStart(area.id,e)}>
              <rect x={p.x+s.w-16} y={p.y+s.h-16} width={16} height={16} fill="transparent"/>
              <path d={`M${p.x+s.w-4} ${p.y+s.h-12} L${p.x+s.w-4} ${p.y+s.h-4} L${p.x+s.w-12} ${p.y+s.h-4}`}
                fill="none" stroke={c+'60'} strokeWidth={1.5}/>
            </g>}
          </g>
        })}
      </svg>

      {editMode&&<div style={{position:'absolute',top:12,left:12,background:'#FEF3C7',border:'1px solid #FDE68A',borderRadius:8,padding:'6px 14px',fontSize:11,color:'#92400E',fontWeight:600}}>
        ✏️ Arraste as áreas · Redimensione pelo canto ↘
      </div>}
    </div>

    <Modal open={!!selEquip} onClose={()=>setSelEquip(null)} title={selEquip?`${selEquip.codigo||''} — ${selEquip.nome}`:''} mobile={vp.isMobile}>
      {selEquip&&<div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:16}}>
          <IC label="Status" value={selEquip.status||'Operando'} color={(STATUS_COLORS[selEquip.status]||STATUS_COLORS['Operando']).dot}/>
          <IC label="Área" value={areas.find(a=>a.id===selEquip.area_id)?.nome||'—'} color={ACCENT}/>
          <IC label="OS Abertas" value={osCount[selEquip.id]||0} color={osCount[selEquip.id]>0?'#EF4444':'#22C55E'}/>
        </div>
        <div style={{fontSize:11,fontWeight:600,color:'#64748B',textTransform:'uppercase',marginBottom:8}}>Últimas Ordens de Serviço</div>
        {loadOS?<div style={{textAlign:'center',padding:20,color:'#94A3B8'}}>Carregando...</div>:
          eqOS.length===0?<div style={{textAlign:'center',padding:20,color:'#94A3B8',fontSize:12}}>Nenhuma OS registrada</div>:
          <div style={{maxHeight:300,overflow:'auto'}}>{eqOS.map(o=>
            <div key={o.id} style={{padding:'8px 0',borderBottom:'1px solid #F1F5F9',fontSize:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:600,color:'#0F172A'}}>
                  <span style={{color:ACCENT,fontWeight:700}}>#{o.numero_ordem||'—'}</span> {(o.titulo||'').substring(0,35)}
                </span>
                <span style={{color:'#94A3B8',fontSize:11}}>{fmtDate(o.data_abertura)}</span>
              </div>
              <div style={{color:'#64748B',fontSize:11,marginTop:2}}>{o.status_os?.icone} {o.status_os?.nome} {o.tipos_manutencao?.nome?`· ${o.tipos_manutencao.nome}`:''}</div>
            </div>
          )}</div>}
      </div>}
    </Modal>
  </div>
}

const ZB = ({children,...p}) => <button {...p} style={{background:'transparent',border:'none',fontSize:16,cursor:'pointer',color:'#475569',width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600}}>{children}</button>

function IC({label,value,color}) {
  return <div style={{background:'#F8FAFC',borderRadius:8,padding:'10px 12px',textAlign:'center',borderTop:`3px solid ${color}`}}>
    <div style={{fontSize:18,fontWeight:800,color}}>{value}</div>
    <div style={{fontSize:9,color:'#94A3B8',textTransform:'uppercase',fontWeight:600}}>{label}</div>
  </div>
}
