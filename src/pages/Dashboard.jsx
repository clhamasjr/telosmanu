import React from 'react'
import { useDashboard, useViewport } from '../hooks/useData'
import { KPI, StatusBadge, PrioBadge, Loading, S, badge, fmtDate } from '../components/UI'
import { ACCENT, FONT_DISPLAY } from '../lib/constants'

export default function Dashboard({ onNavigate }) {
  const { kpis, osPorArea, osAbertas, osAndamento, pecasBaixo, osRecentes, loading } = useDashboard()
  const vp = useViewport()
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
            {o.mecanicos?.nome && <span style={{ fontSize:10,color:'#666' }}>👨‍🔧 {o.mecanicos.nome}</span>}
          </div>)}
        </div>}
    </div>
  )

  return <div>
    <h1 style={{ margin:'0 0 20px',fontFamily:FONT_DISPLAY,fontSize:vp.isMobile?24:32,letterSpacing:2,color:ACCENT }}>DASHBOARD</h1>
    <div style={{ display:'flex',gap:vp.isMobile?10:14,flexWrap:'wrap',marginBottom:24 }}>
      <KPI label="Abertas" value={kpis.abertas||0} accent="#F59E0B" sub="Aguardando" small={vp.isMobile} />
      <KPI label="Andamento" value={kpis.emAndamento||0} accent="#3B82F6" sub="Execução" small={vp.isMobile} />
      <KPI label="Ag. Peça" value={kpis.aguardPeca||0} accent="#A855F7" sub="Bloqueadas" small={vp.isMobile} />
      <KPI label="Urgentes" value={kpis.urgentes||0} accent="#EF4444" sub="Prioridade" small={vp.isMobile} />
      <KPI label="Concluídas" value={kpis.concluidas||0} accent="#22C55E" small={vp.isMobile} />
    </div>

    {/* OS Abertas e Em Andamento lado a lado */}
    <div style={{ display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr',gap:16,marginBottom:16 }}>
      <OSList items={osAbertas} title="🔴 OS Abertas" emptyMsg="Nenhuma OS aberta" />
      <OSList items={osAndamento} title="🔧 OS Em Andamento" emptyMsg="Nenhuma em andamento" />
    </div>

    <div style={{ display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr',gap:16 }}>
      <div style={S.card}>
        <h3 style={{ margin:'0 0 12px',fontSize:12,color:'#888',textTransform:'uppercase',letterSpacing:1 }}>OS por Área</h3>
        {osPorArea.length===0?<div style={{color:'#555',fontSize:12,padding:16,textAlign:'center'}}>Sem dados</div>:
          osPorArea.map(([a,c])=>{const mx=Math.max(...osPorArea.map(x=>x[1]));return<div key={a} style={{marginBottom:10}}>
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
        <h3 style={{ margin:'0 0 12px',fontSize:12,color:'#888',textTransform:'uppercase',letterSpacing:1 }}>Resumo</h3>
        {[['⚙️ Equipamentos',kpis.totalEquip],['👨‍🔧 Mecânicos',kpis.totalMec],['📋 Total OS',kpis.totalOS]].map(([l,v])=>
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #1A1A1E',fontSize:13}}>
            <span style={{color:'#999'}}>{l}</span><span style={{color:'#E5E5E5',fontWeight:700}}>{v||0}</span>
          </div>)}
      </div>
    </div>
  </div>
}
