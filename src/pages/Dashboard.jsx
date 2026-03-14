import React, { useState } from 'react'
import { useDashboard, useViewport } from '../hooks/useData'
import { KPI, StatusBadge, PrioBadge, Loading, S, badge, fmtDate } from '../components/UI'
import { ACCENT, FONT_DISPLAY, FONT } from '../lib/constants'

export default function Dashboard({ onNavigate }) {
  const vp = useViewport()
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' })
  const { kpis, osPorArea, osAbertas, osAndamento, pecasBaixo, osRecentes, loading } = useDashboard(dateFilter.from || dateFilter.to ? dateFilter : null)

  if (loading) return <Loading />

  const OSList = ({ items, title, emptyMsg }) => (
    <div style={S.card}>
      <h3 style={{ margin:'0 0 12px',fontSize:12,color:'#888',textTransform:'uppercase',letterSpacing:1 }}>{title} ({items.length})</h3>
      {items.length === 0 ? <div style={{ color:'#555',fontSize:12,padding:16,textAlign:'center' }}>{emptyMsg}</div> :
        <div style={{ maxHeight:300,overflow:'auto' }}>
          {items.map(o => <div key={o.id} style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:'1px solid #1A1A1E',flexWrap:'wrap',cursor:'pointer' }} onClick={()=>onNavigate?.('ordens')}>
            <span style={{ fontSize:11,color:ACCENT,fontWeight:700,minWidth:50 }}>#{o.numero_ordem_legado||'—'}</span>
            <span style={{ flex:1,fontSize:12,color:'#CCC',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:80 }}>{o.titulo||'Sem título'}</span>
            <span style={{ fontSize:11,color:'#888' }}>{o.areas?.nome||''}</span>
            <PrioBadge p={o.prioridade} />
            {o.equipamentos?.nome && <span style={{ fontSize:10,color:'#666' }}>⚙️ {o.equipamentos.nome}</span>}
            <span style={{ fontSize:10,color:'#555' }}>{fmtDate(o.data_abertura)}</span>
          </div>)}
        </div>}
    </div>
  )

  return <div>
    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12 }}>
      <h1 style={{ margin:0,fontFamily:FONT_DISPLAY,fontSize:vp.isMobile?24:32,letterSpacing:2,color:ACCENT }}>DASHBOARD</h1>
      <div style={{ display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' }}>
        <label style={{ fontSize:10,color:'#666' }}>DE</label>
        <input type="date" value={dateFilter.from} onChange={e=>setDateFilter(f=>({...f,from:e.target.value}))} style={{ ...S.input,width:140,marginBottom:0,padding:'6px 8px',fontSize:12 }} />
        <label style={{ fontSize:10,color:'#666' }}>ATÉ</label>
        <input type="date" value={dateFilter.to} onChange={e=>setDateFilter(f=>({...f,to:e.target.value}))} style={{ ...S.input,width:140,marginBottom:0,padding:'6px 8px',fontSize:12 }} />
        {(dateFilter.from||dateFilter.to) && <button style={{ ...S.btnS,padding:'6px 10px',minHeight:32,fontSize:11 }} onClick={()=>setDateFilter({from:'',to:''})}>✕ Limpar</button>}
      </div>
    </div>

    <div style={{ display:'flex',gap:vp.isMobile?10:14,flexWrap:'wrap',marginBottom:24 }}>
      <KPI label="Abertas" value={kpis.abertas||0} accent="#F59E0B" sub="Aguardando" small={vp.isMobile} />
      <KPI label="Andamento" value={kpis.emAndamento||0} accent="#3B82F6" sub="Execução" small={vp.isMobile} />
      <KPI label="Ag. Peça" value={kpis.aguardPeca||0} accent="#A855F7" sub="Bloqueadas" small={vp.isMobile} />
      <KPI label="Concluídas" value={kpis.concluidas||0} accent="#22C55E" small={vp.isMobile} />
      <KPI label="Total OS" value={kpis.totalOS||0} accent="#888" sub="Todas" small={vp.isMobile} />
    </div>

    <div style={{ display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr',gap:16,marginBottom:16 }}>
      <OSList items={osAbertas} title="🔴 OS Abertas" emptyMsg="Nenhuma OS aberta" />
      <OSList items={osAndamento} title="🔧 OS Em Andamento" emptyMsg="Nenhuma em andamento" />
    </div>

    <div style={{ display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr',gap:16 }}>
      <div style={S.card}>
        <h3 style={{ margin:'0 0 12px',fontSize:12,color:'#888',textTransform:'uppercase',letterSpacing:1 }}>OS Ativas por Área</h3>
        {osPorArea.length===0?<div style={{color:'#555',fontSize:12,padding:16,textAlign:'center'}}>Sem dados</div>:
          osPorArea.slice(0,12).map(([a,c])=>{const mx=Math.max(...osPorArea.map(x=>x[1]));return<div key={a} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}><span style={{color:'#CCC'}}>{a}</span><span style={{color:ACCENT,fontWeight:700}}>{c}</span></div>
            <div style={{background:'#1A1A1E',borderRadius:3,height:6}}><div style={{background:`linear-gradient(90deg,${ACCENT},#F59E0B)`,height:'100%',borderRadius:3,width:`${(c/mx)*100}%`}}/></div>
          </div>})}
      </div>

      <div style={S.card}>
        <h3 style={{ margin:'0 0 12px',fontSize:12,color:'#888',textTransform:'uppercase',letterSpacing:1 }}>⚠️ Estoque Baixo ({kpis.pecasBaixo||0})</h3>
        {pecasBaixo.length===0?<div style={{color:'#22C55E',fontSize:12,padding:16,textAlign:'center'}}>Estoque OK</div>:
          pecasBaixo.slice(0,8).map(p=><div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #1A1A1E',fontSize:12}}>
            <span style={{color:'#CCC'}}>{p.nome}</span>
            <span style={{color:p.quantidade===0?'#EF4444':'#F59E0B',fontWeight:700}}>{p.quantidade}/{p.estoque_minimo}</span>
          </div>)}
      </div>

      <div style={S.card}>
        <h3 style={{ margin:'0 0 12px',fontSize:12,color:'#888',textTransform:'uppercase',letterSpacing:1 }}>OS Recentes</h3>
        {osRecentes.length===0?<div style={{color:'#555',fontSize:12,padding:16,textAlign:'center'}}>—</div>:
          osRecentes.map(o=><div key={o.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #1A1A1E',flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'#CCC',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.titulo||'—'}</span>
            <StatusBadge status={o.status_os}/>
            <span style={{fontSize:10,color:'#555'}}>{fmtDate(o.data_abertura)}</span>
          </div>)}
      </div>

      <div style={S.card}>
        <h3 style={{ margin:'0 0 12px',fontSize:12,color:'#888',textTransform:'uppercase',letterSpacing:1 }}>Resumo</h3>
        {[['⚙️ Equipamentos',kpis.totalEquip],['👨‍🔧 Mecânicos',kpis.totalMec],['📋 Total OS',kpis.totalOS]].map(([l,v])=>
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #1A1A1E',fontSize:13}}>
            <span style={{color:'#999'}}>{l}</span><span style={{color:'#E5E5E5',fontWeight:700}}>{v||0}</span>
          </div>)}
      </div>
    </div>
  </div>
}
