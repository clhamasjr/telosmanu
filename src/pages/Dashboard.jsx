import React, { useState, useEffect, useMemo } from 'react'
import { useViewport } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { KPI, StatusBadge, PrioBadge, Loading, S, badge, fmtDate, fmtDT, fmtHrs } from '../components/UI'
import { ACCENT, FONT_DISPLAY, FONT } from '../lib/constants'

const today = () => new Date().toISOString().split('T')[0]
const PRESETS = [
  { label: 'Mês Atual', fn: () => { const d = new Date(); return { from: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, to: today() } } },
  { label: 'Mês Anterior', fn: () => { const d = new Date(); d.setMonth(d.getMonth()-1); const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'); return { from:`${y}-${m}-01`, to:`${y}-${m}-${new Date(y,d.getMonth()+1,0).getDate()}` } } },
  { label: 'Trimestre', fn: () => { const d = new Date(); d.setMonth(d.getMonth()-3); return { from: d.toISOString().split('T')[0], to: today() } } },
  { label: 'Semestre', fn: () => { const d = new Date(); d.setMonth(d.getMonth()-6); return { from: d.toISOString().split('T')[0], to: today() } } },
  { label: 'Anual', fn: () => ({ from: `${new Date().getFullYear()}-01-01`, to: today() }) } },
  { label: 'Tudo', fn: () => ({ from: '', to: '' }) } },
]

export default function Dashboard({ onNavigate, onFilterOS }) {
  const vp = useViewport()
  const [preset, setPreset] = useState('Tudo')
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' })
  const [custom, setCustom] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [osDetail, setOsDetail] = useState(null) // which KPI was clicked

  const applyPreset = (p) => {
    setPreset(p.label)
    setCustom(false)
    setDateFilter(p.fn())
  }

  // Load data
  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: statuses } = await supabase.from('status_os').select('id,nome,cor,cor_bg,icone')
      const stMap = {}; (statuses||[]).forEach(s => stMap[s.nome]=s)

      // Exact counts (always ALL time for KPIs)
      const countFor = async (nome) => {
        const st = stMap[nome]; if (!st) return 0
        const { count } = await supabase.from('ordens_servico').select('id',{count:'exact',head:true}).eq('status_id',st.id)
        return count||0
      }
      const [abertas,andamento,aguard,concluidas,totalOS,eqCount,mecCount] = await Promise.all([
        countFor('Aberta'),countFor('Em Andamento'),countFor('Aguardando Peça'),countFor('Concluída'),
        supabase.from('ordens_servico').select('id',{count:'exact',head:true}).then(r=>r.count||0),
        supabase.from('equipamentos').select('id',{count:'exact',head:true}).then(r=>r.count||0),
        supabase.from('mecanicos').select('id',{count:'exact',head:true}).eq('ativo',true).then(r=>r.count||0),
      ])

      // OS abertas (ALWAYS all, no date filter)
      const { data: osAbertas } = await supabase.from('ordens_servico')
        .select('id,titulo,prioridade,data_abertura,executado_por,areas(nome),equipamentos(nome,codigo),mecanicos(nome),status_os!inner(nome,cor,cor_bg,icone)')
        .eq('status_os.nome','Aberta').order('data_abertura',{ascending:false}).limit(50)

      // OS em andamento (ALWAYS all)
      const { data: osAndamento } = await supabase.from('ordens_servico')
        .select('id,titulo,prioridade,data_abertura,data_inicio,executado_por,areas(nome),equipamentos(nome,codigo),mecanicos(nome),status_os!inner(nome,cor,cor_bg,icone)')
        .eq('status_os.nome','Em Andamento').order('data_abertura',{ascending:false}).limit(50)

      // Mecânicos em atendimento AGORA (OS em andamento com mecânico)
      const mecAtendendo = (osAndamento||[]).filter(o => o.mecanicos?.nome || o.executado_por).map(o => ({
        mecanico: o.mecanicos?.nome || o.executado_por,
        os: o.titulo, area: o.areas?.nome, equip: o.equipamentos?.nome,
        desde: o.data_inicio || o.data_abertura,
      }))

      // OS por area (with date filter)
      let areaQ = supabase.from('ordens_servico').select('areas(nome),status_os(nome)')
      if (dateFilter.from) areaQ = areaQ.gte('data_abertura', dateFilter.from+'T00:00:00')
      if (dateFilter.to) areaQ = areaQ.lte('data_abertura', dateFilter.to+'T23:59:59')
      const { data: areaOS } = await areaQ.range(0,9999)
      const areaMap = {}
      ;(areaOS||[]).forEach(o => { const a=o.areas?.nome||'Sem área'; areaMap[a]=(areaMap[a]||0)+1 })

      // Recentes (with date filter)
      let recQ = supabase.from('ordens_servico').select('id,titulo,prioridade,data_abertura,status_os(nome,cor,cor_bg,icone),areas(nome)').order('data_abertura',{ascending:false}).limit(15)
      if (dateFilter.from) recQ = recQ.gte('data_abertura', dateFilter.from+'T00:00:00')
      if (dateFilter.to) recQ = recQ.lte('data_abertura', dateFilter.to+'T23:59:59')
      const { data: recentes } = await recQ

      // Peças estoque baixo
      const { data: matData } = await supabase.from('materiais').select('id,nome,codigo,quantidade,estoque_minimo').eq('ativo',true)
      const pecasBaixo = (matData||[]).filter(p => p.quantidade <= p.estoque_minimo)

      // Period counts (with date filter)
      let periodTotal = totalOS
      if (dateFilter.from || dateFilter.to) {
        let pQ = supabase.from('ordens_servico').select('id',{count:'exact',head:true})
        if (dateFilter.from) pQ = pQ.gte('data_abertura', dateFilter.from+'T00:00:00')
        if (dateFilter.to) pQ = pQ.lte('data_abertura', dateFilter.to+'T23:59:59')
        const { count } = await pQ
        periodTotal = count||0
      }

      setData({
        kpis: { abertas, andamento, aguard, concluidas, totalOS, periodTotal, eqCount, mecCount, pecasBaixo: pecasBaixo.length },
        osAbertas: osAbertas||[], osAndamento: osAndamento||[],
        mecAtendendo,
        osPorArea: Object.entries(areaMap).sort((a,b)=>b[1]-a[1]),
        osRecentes: recentes||[], pecasBaixo,
        stMap,
      })
      setLoading(false)
    })()
  }, [dateFilter.from, dateFilter.to])

  if (loading || !data) return <Loading />
  const { kpis, osAbertas, osAndamento, mecAtendendo, osPorArea, osRecentes, pecasBaixo } = data

  const handleKPIClick = (statusFilter) => {
    if (onFilterOS) onFilterOS(statusFilter)
    if (onNavigate) onNavigate('ordens')
  }

  const OSList = ({ items, title, emptyMsg }) => (
    <div style={S.card}>
      <h3 style={{ margin:'0 0 10px',fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1 }}>{title} ({items.length})</h3>
      {items.length===0?<div style={{color:'#555',fontSize:12,padding:12,textAlign:'center'}}>{emptyMsg}</div>:
        <div style={{maxHeight:280,overflow:'auto'}}>{items.map(o=>
          <div key={o.id} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 0',borderBottom:'1px solid #1A1A1E',flexWrap:'wrap',cursor:'pointer'}} onClick={()=>onNavigate?.('ordens')}>
            <span style={{flex:1,fontSize:12,color:'#CCC',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:60}}>{(o.titulo||'').substring(0,50)}</span>
            <span style={{fontSize:10,color:'#888'}}>{o.areas?.nome||''}</span>
            {o.equipamentos?.nome&&<span style={{fontSize:10,color:ACCENT}}>{o.equipamentos.nome}</span>}
            <PrioBadge p={o.prioridade}/>
            <span style={{fontSize:9,color:'#555'}}>{fmtDate(o.data_abertura)}</span>
          </div>
        )}</div>}
    </div>
  )

  return <div>
    {/* Header + Date presets */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:10}}>
      <h1 style={{margin:0,fontFamily:FONT_DISPLAY,fontSize:vp.isMobile?22:30,letterSpacing:2,color:ACCENT}}>DASHBOARD</h1>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
        {PRESETS.map(p=><button key={p.label} onClick={()=>applyPreset(p)} style={{
          ...S.btnS, padding:'6px 12px',minHeight:30,fontSize:10,fontWeight:600,
          background:preset===p.label?ACCENT+'22':'transparent',
          color:preset===p.label?ACCENT:'#888',
          borderColor:preset===p.label?ACCENT:'#2A2A30',
        }}>{p.label}</button>)}
        <button onClick={()=>setCustom(!custom)} style={{...S.btnS,padding:'6px 12px',minHeight:30,fontSize:10,color:custom?ACCENT:'#888',borderColor:custom?ACCENT:'#2A2A30'}}>📅 Personalizado</button>
      </div>
    </div>
    {custom&&<div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
      <input type="date" value={dateFilter.from} onChange={e=>{setDateFilter(f=>({...f,from:e.target.value}));setPreset('')}} style={{...S.input,width:140,marginBottom:0,padding:'6px 8px',fontSize:11}}/>
      <span style={{color:'#666',fontSize:11}}>até</span>
      <input type="date" value={dateFilter.to} onChange={e=>{setDateFilter(f=>({...f,to:e.target.value}));setPreset('')}} style={{...S.input,width:140,marginBottom:0,padding:'6px 8px',fontSize:11}}/>
    </div>}

    {/* KPIs - Clickable */}
    <div style={{display:'flex',gap:vp.isMobile?8:12,flexWrap:'wrap',marginBottom:20}}>
      <div onClick={()=>handleKPIClick('Aberta')} style={{cursor:'pointer',flex:vp.isMobile?'1 1 45%':'1 1 140px'}}>
        <KPI label="Abertas" value={kpis.abertas} accent="#F59E0B" sub="Clique p/ ver" small={vp.isMobile}/>
      </div>
      <div onClick={()=>handleKPIClick('Em Andamento')} style={{cursor:'pointer',flex:vp.isMobile?'1 1 45%':'1 1 140px'}}>
        <KPI label="Andamento" value={kpis.andamento} accent="#3B82F6" sub="Clique p/ ver" small={vp.isMobile}/>
      </div>
      <div onClick={()=>handleKPIClick('Aguardando Peça')} style={{cursor:'pointer',flex:vp.isMobile?'1 1 45%':'1 1 140px'}}>
        <KPI label="Ag. Peça" value={kpis.aguard} accent="#A855F7" sub="Clique p/ ver" small={vp.isMobile}/>
      </div>
      <div onClick={()=>handleKPIClick('Concluída')} style={{cursor:'pointer',flex:vp.isMobile?'1 1 45%':'1 1 140px'}}>
        <KPI label="Concluídas" value={kpis.concluidas} accent="#22C55E" small={vp.isMobile}/>
      </div>
      <KPI label={dateFilter.from?'No Período':'Total OS'} value={dateFilter.from?kpis.periodTotal:kpis.totalOS} accent="#888" small={vp.isMobile}/>
    </div>

    {/* Mecânicos em atendimento AGORA */}
    {mecAtendendo.length>0&&<div style={{...S.card,borderLeft:'3px solid #3B82F6',marginBottom:16}}>
      <h3 style={{margin:'0 0 10px',fontSize:11,color:'#3B82F6',textTransform:'uppercase',letterSpacing:1}}>🔧 Mecânicos em Atendimento Agora ({mecAtendendo.length})</h3>
      {mecAtendendo.map((m,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #1A1A1E',flexWrap:'wrap',gap:6}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:'#E5E5E5'}}>👨‍🔧 {m.mecanico}</div>
          <div style={{fontSize:12,color:'#CCC'}}>{(m.os||'').substring(0,60)}</div>
        </div>
        <div style={{textAlign:'right'}}>
          {m.area&&<span style={badge('#3B82F6')}>{m.area}</span>}
          {m.equip&&<div style={{fontSize:10,color:ACCENT,marginTop:2}}>⚙️ {m.equip}</div>}
        </div>
      </div>)}
    </div>}

    {/* OS Abertas e Em Andamento (sempre ALL) */}
    <div style={{display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr',gap:14,marginBottom:14}}>
      <OSList items={osAbertas} title="🔴 OS Abertas (todas)" emptyMsg="Nenhuma aberta"/>
      <OSList items={osAndamento} title="🔧 OS Em Andamento (todas)" emptyMsg="Nenhuma em andamento"/>
    </div>

    <div style={{display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr',gap:14}}>
      <div style={S.card}>
        <h3 style={{margin:'0 0 10px',fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1}}>OS por Área {dateFilter.from?'(período)':'(ativas)'}</h3>
        {osPorArea.length===0?<div style={{color:'#555',fontSize:12,padding:12,textAlign:'center'}}>Sem dados</div>:
          osPorArea.slice(0,12).map(([a,c])=>{const mx=Math.max(...osPorArea.map(x=>x[1]));return<div key={a} style={{marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}><span style={{color:'#CCC'}}>{a}</span><span style={{color:ACCENT,fontWeight:700}}>{c}</span></div>
            <div style={{background:'#1A1A1E',borderRadius:3,height:5}}><div style={{background:`linear-gradient(90deg,${ACCENT},#F59E0B)`,height:'100%',borderRadius:3,width:`${(c/mx)*100}%`}}/></div>
          </div>})}
      </div>

      <div style={S.card}>
        <h3 style={{margin:'0 0 10px',fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1}}>⚠️ Estoque Baixo ({kpis.pecasBaixo})</h3>
        {pecasBaixo.length===0?<div style={{color:'#22C55E',fontSize:12,padding:12,textAlign:'center'}}>Estoque OK</div>:
          pecasBaixo.slice(0,8).map(p=><div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #1A1A1E',fontSize:11}}>
            <span style={{color:'#CCC'}}>{p.nome}</span>
            <span style={{color:p.quantidade===0?'#EF4444':'#F59E0B',fontWeight:700}}>{p.quantidade}/{p.estoque_minimo}</span>
          </div>)}
      </div>

      <div style={S.card}>
        <h3 style={{margin:'0 0 10px',fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1}}>Resumo Geral</h3>
        {[['⚙️ Equipamentos',kpis.eqCount],['👨‍🔧 Mecânicos',kpis.mecCount],['📋 Total OS',kpis.totalOS]].map(([l,v])=>
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #1A1A1E',fontSize:12}}>
            <span style={{color:'#999'}}>{l}</span><span style={{color:'#E5E5E5',fontWeight:700}}>{v||0}</span>
          </div>)}
      </div>

      <div style={S.card}>
        <h3 style={{margin:'0 0 10px',fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1}}>OS Recentes</h3>
        {osRecentes.map(o=><div key={o.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:'1px solid #1A1A1E',flexWrap:'wrap'}}>
          <span style={{flex:1,fontSize:11,color:'#CCC',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(o.titulo||'').substring(0,40)}</span>
          <StatusBadge status={o.status_os}/>
          <span style={{fontSize:9,color:'#555'}}>{fmtDate(o.data_abertura)}</span>
        </div>)}
      </div>
    </div>
  </div>
}
