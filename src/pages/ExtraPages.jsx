import React, { useState, useMemo } from 'react'
import { useTable, useLookups, useViewport, useRelatorios } from '../hooks/useData'
import { S, badge, Modal, Field, Empty, Search, Header, Loading, KPI, fmtDate, fmtHrs } from '../components/UI'
import { PERIODICIDADES, PERFIS, ACCENT, FONT_DISPLAY } from '../lib/constants'
import { supabase } from '../lib/supabase'

// ══════════════════ PREVENTIVA & CALENDÁRIO ══════════════════
export function Preventiva() {
  const { data, loading, insert, update, remove } = useTable('planejamento_manutencao', { order: 'data_programada', ascending: true })
  const { areas, equipamentos } = useLookups()
  const vp = useViewport()
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)
  const [viewMode, setViewMode] = useState('lista') // lista | calendario
  const [mesAtual, setMesAtual] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })

  const novo = () => { setItem({ descricao:'', codigo:'', equipamento_id:'', periodicidade:'Mensal', data_base:'', data_programada:'', ativo:true }); setModal('novo') }
  const salvar = async () => {
    if (!(item.descricao||'').trim()) return
    const p = { ...item }; delete p.id; delete p.created_at; delete p.updated_at
    Object.keys(p).forEach(k => { if (p[k]==='') p[k]=null })
    if (item.id) await update(item.id, p); else await insert(p)
    setModal(null)
  }

  // Calendar data
  const calendarDays = useMemo(() => {
    const [year, month] = mesAtual.split('-').map(Number)
    const firstDay = new Date(year, month-1, 1)
    const lastDay = new Date(year, month, 0)
    const startPad = firstDay.getDay()
    const days = []
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
    return days
  }, [mesAtual])

  const planByDate = useMemo(() => {
    const map = {}
    data.filter(p => p.data_programada && p.ativo !== false).forEach(p => {
      const d = p.data_programada.substring(0, 10)
      if (!map[d]) map[d] = []
      map[d].push(p)
    })
    return map
  }, [data])

  const prevMonth = () => { const [y,m] = mesAtual.split('-').map(Number); const d = new Date(y,m-2,1); setMesAtual(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }
  const nextMonth = () => { const [y,m] = mesAtual.split('-').map(Number); const d = new Date(y,m,1); setMesAtual(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }
  const mesNome = new Date(mesAtual+'-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  if (loading) return <Loading />

  return <div>
    <Header title="MANUTENÇÃO PREVENTIVA" action={novo} label="+ NOVO PLANO" mobile={vp.isMobile} />

    <div style={{ display:'flex', gap:10, marginBottom:16 }}>
      <button style={viewMode==='lista'?S.btnP:{...S.btnS}} onClick={()=>setViewMode('lista')}>📋 Lista</button>
      <button style={viewMode==='calendario'?S.btnP:{...S.btnS}} onClick={()=>setViewMode('calendario')}>📅 Calendário</button>
      <span style={{ fontSize:11,color:'#555',marginLeft:'auto' }}>{data.filter(p=>p.ativo!==false).length} plano(s) ativos</span>
    </div>

    {viewMode === 'calendario' ? (
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <button style={S.btnS} onClick={prevMonth}>◀</button>
          <h3 style={{ fontFamily:FONT_DISPLAY, fontSize:22, color:ACCENT, letterSpacing:1, textTransform:'capitalize' }}>{mesNome}</h3>
          <button style={S.btnS} onClick={nextMonth}>▶</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => <div key={d} style={{ textAlign:'center',fontSize:10,color:'#666',padding:4,fontWeight:600 }}>{d}</div>)}
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={`pad-${i}`} />
            const dateStr = `${mesAtual}-${String(day).padStart(2,'0')}`
            const plans = planByDate[dateStr] || []
            const isToday = dateStr === new Date().toISOString().split('T')[0]
            return <div key={i} style={{
              background: plans.length > 0 ? '#1E3A5F' : '#1A1A1E',
              border: isToday ? `2px solid ${ACCENT}` : '1px solid #1F1F23',
              borderRadius: 6, padding: 6, minHeight: vp.isMobile ? 40 : 60, cursor: plans.length > 0 ? 'pointer' : 'default'
            }}>
              <div style={{ fontSize:12, color: isToday ? ACCENT : '#888', fontWeight: isToday ? 700 : 400 }}>{day}</div>
              {plans.slice(0,2).map(p => <div key={p.id} style={{ fontSize:9, color:'#3B82F6', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                🔧 {(p.descricao||'').substring(0,15)}
              </div>)}
              {plans.length > 2 && <div style={{ fontSize:9, color:'#666' }}>+{plans.length-2} mais</div>}
            </div>
          })}
        </div>
      </div>
    ) : (
      data.filter(p => p.ativo !== false).length === 0 ? <Empty icon="📅" msg="Nenhum plano preventivo" action="Criar Plano" onAction={novo} /> :
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {data.filter(p => p.ativo !== false).map(p => {
          const eq = equipamentos.find(e => e.id === p.equipamento_id)
          const vencido = p.data_programada && new Date(p.data_programada) < new Date()
          return <div key={p.id} style={{ ...S.card, borderLeft:`3px solid ${vencido?'#EF4444':'#3B82F6'}`, cursor:'pointer' }} onClick={() => { setItem({ ...p }); setModal('editar') }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontWeight:700, color:'#E5E5E5', fontSize:14 }}>{p.descricao || 'Plano preventivo'}</span>
              <span style={badge(vencido ? '#EF4444' : '#3B82F6')}>{vencido ? 'VENCIDO' : p.periodicidade || 'Programado'}</span>
            </div>
            <div style={{ fontSize:12, color:'#888' }}>
              {eq && <span>⚙️ {eq.nome} · </span>}
              {p.codigo && <span style={{ color:ACCENT }}>Cod: {p.codigo} · </span>}
              📅 Próxima: <strong style={{ color: vencido ? '#EF4444' : '#E5E5E5' }}>{fmtDate(p.data_programada)}</strong>
            </div>
          </div>
        })}
      </div>
    )}

    <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'NOVO PLANO PREVENTIVO' : 'EDITAR PLANO'} mobile={vp.isMobile}>
      {item && <div>
        <Field label="Descrição" req><input style={S.input} value={item.descricao||''} onChange={e => setItem({...item, descricao: e.target.value})} placeholder="Ex: Lubrificação mensal cardas" /></Field>
        <div style={{ display:'grid', gridTemplateColumns: vp.isMobile ? '1fr' : '1fr 1fr', gap:'0 16px' }}>
          <Field label="Código"><input style={S.input} value={item.codigo||''} onChange={e => setItem({...item, codigo: e.target.value})} /></Field>
          <Field label="Equipamento"><select style={S.select} value={item.equipamento_id||''} onChange={e => setItem({...item, equipamento_id: e.target.value})}>
            <option value="">Selecione</option>{equipamentos.map(e => <option key={e.id} value={e.id}>{e.nome}{e.codigo ? ` (${e.codigo})` : ''}</option>)}
          </select></Field>
          <Field label="Periodicidade"><select style={S.select} value={item.periodicidade||''} onChange={e => setItem({...item, periodicidade: e.target.value})}>
            <option value="">Selecione</option>{PERIODICIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select></Field>
          <Field label="Data Programada"><input style={S.input} type="date" value={item.data_programada||''} onChange={e => setItem({...item, data_programada: e.target.value})} /></Field>
          <Field label="Data Base"><input style={S.input} type="date" value={item.data_base||''} onChange={e => setItem({...item, data_base: e.target.value})} /></Field>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:20, paddingTop:16, borderTop:'1px solid #1F1F23', gap:10, flexWrap:'wrap' }}>
          {modal==='editar' && <button style={S.btnD} onClick={async () => { await remove(item.id); setModal(null) }}>Excluir</button>}
          <div style={{ display:'flex', gap:10, marginLeft:'auto' }}><button style={S.btnS} onClick={() => setModal(null)}>Cancelar</button><button style={S.btnP} onClick={salvar}>Salvar</button></div>
        </div>
      </div>}
    </Modal>
  </div>
}

// ══════════════════ RELATÓRIOS ══════════════════
export function Relatorios() {
  const vp = useViewport()
  const [periodo, setPeriodo] = useState({ from:'2024-01-01', to: new Date().toISOString().split('T')[0] })
  const rel = useRelatorios(periodo)

  if (rel.loading) return <Loading />

  return <div>
    <h1 style={{ margin:'0 0 20px', fontFamily:FONT_DISPLAY, fontSize:vp.isMobile?22:32, letterSpacing:2, color:ACCENT }}>RELATÓRIOS & INDICADORES</h1>

    <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
      <Field label="Período de"><input style={{...S.input,width:160}} type="date" value={periodo.from} onChange={e=>setPeriodo({...periodo,from:e.target.value})}/></Field>
      <Field label="Até"><input style={{...S.input,width:160}} type="date" value={periodo.to} onChange={e=>setPeriodo({...periodo,to:e.target.value})}/></Field>
    </div>

    {/* KPIs */}
    <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:24 }}>
      <KPI label="MTTR" value={`${rel.mttr.toFixed(1)}h`} accent="#3B82F6" sub="Tempo Médio de Reparo" small={vp.isMobile} />
      <KPI label="MTBF" value={`${rel.mtbf.toFixed(0)}h`} accent="#22C55E" sub="Tempo Médio Entre Falhas" small={vp.isMobile} />
      <KPI label="Total OS" value={rel.records.length} accent="#F59E0B" sub="No período" small={vp.isMobile} />
      <KPI label="Horas Disp." value={`${rel.horasDisponiveis}h`} accent="#A855F7" sub="Por mecânico no período" small={vp.isMobile} />
    </div>

    <div style={{ display:'grid', gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr', gap:16 }}>
      {/* OS por mecânico */}
      <div style={S.card}>
        <h3 style={{ margin:'0 0 14px', fontSize:12, color:'#888', textTransform:'uppercase', letterSpacing:1 }}>👨‍🔧 OS por Mecânico</h3>
        {rel.osPorMec.length === 0 ? <div style={{ color:'#555', textAlign:'center', padding:16 }}>Sem dados</div> :
          rel.osPorMec.map(m => <div key={m.nome} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #1A1A1E' }}>
            <div>
              <div style={{ fontSize:13, color:'#E5E5E5', fontWeight:600 }}>{m.nome}</div>
              <div style={{ fontSize:11, color:'#888' }}>Tempo médio: {m.tempoMedio.toFixed(0)}min · Total: {fmtHrs(m.tempoTotal)}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:18, fontWeight:700, color:ACCENT }}>{m.total}</div>
              <div style={{ fontSize:10, color:'#666' }}>OS</div>
            </div>
          </div>)}
      </div>

      {/* Horas trabalhadas vs disponíveis */}
      <div style={S.card}>
        <h3 style={{ margin:'0 0 14px', fontSize:12, color:'#888', textTransform:'uppercase', letterSpacing:1 }}>⏱️ Controle de Horas</h3>
        {rel.mecanicos.length === 0 ? <div style={{ color:'#555', textAlign:'center', padding:16 }}>Sem dados</div> :
          rel.mecanicos.map(mec => {
            const hhData = rel.hhPorMec.find(h => h.nome === mec.nome)
            const osData = rel.osPorMec.find(o => o.nome === mec.nome)
            const horasUsadas = hhData ? hhData.horas : (osData ? osData.tempoTotal / 60 : 0)
            const pct = rel.horasDisponiveis > 0 ? Math.min(100, (horasUsadas / rel.horasDisponiveis) * 100) : 0
            const barColor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#22C55E'
            return <div key={mec.id} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                <span style={{ color:'#CCC' }}>{mec.nome}</span>
                <span style={{ color:barColor, fontWeight:700 }}>{horasUsadas.toFixed(1)}h / {rel.horasDisponiveis}h ({pct.toFixed(0)}%)</span>
              </div>
              <div style={{ background:'#1A1A1E', borderRadius:3, height:8 }}>
                <div style={{ background:barColor, height:'100%', borderRadius:3, width:`${pct}%`, transition:'width .5s' }} />
              </div>
            </div>
          })}
      </div>

      {/* Falhas por tipo */}
      <div style={S.card}>
        <h3 style={{ margin:'0 0 14px', fontSize:12, color:'#888', textTransform:'uppercase', letterSpacing:1 }}>🔧 OS por Tipo de Falha</h3>
        {(() => {
          const falhaMap = {}
          rel.records.forEach(o => { const f = o.tipos_falha?.nome || 'Não classificada'; falhaMap[f] = (falhaMap[f]||0)+1 })
          const falhas = Object.entries(falhaMap).sort((a,b)=>b[1]-a[1])
          return falhas.length === 0 ? <div style={{ color:'#555', textAlign:'center', padding:16 }}>Sem dados</div> :
            falhas.map(([f,c]) => {
              const mx = Math.max(...falhas.map(x=>x[1]))
              return <div key={f} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ color:'#CCC' }}>{f}</span><span style={{ color:ACCENT, fontWeight:700 }}>{c}</span>
                </div>
                <div style={{ background:'#1A1A1E', borderRadius:3, height:6 }}>
                  <div style={{ background:`linear-gradient(90deg,${ACCENT},#F59E0B)`, height:'100%', borderRadius:3, width:`${(c/mx)*100}%` }} />
                </div>
              </div>
            })
        })()}
      </div>

      {/* OS por área */}
      <div style={S.card}>
        <h3 style={{ margin:'0 0 14px', fontSize:12, color:'#888', textTransform:'uppercase', letterSpacing:1 }}>🏭 OS por Área</h3>
        {(() => {
          const areaMap = {}
          rel.records.forEach(o => { const a = o.areas?.nome || 'Sem área'; areaMap[a] = (areaMap[a]||0)+1 })
          const list = Object.entries(areaMap).sort((a,b)=>b[1]-a[1])
          return list.length === 0 ? <div style={{ color:'#555', textAlign:'center', padding:16 }}>Sem dados</div> :
            list.map(([a,c]) => {
              const mx = Math.max(...list.map(x=>x[1]))
              return <div key={a} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ color:'#CCC' }}>{a}</span><span style={{ color:'#3B82F6', fontWeight:700 }}>{c}</span>
                </div>
                <div style={{ background:'#1A1A1E', borderRadius:3, height:6 }}>
                  <div style={{ background:'linear-gradient(90deg,#3B82F6,#60A5FA)', height:'100%', borderRadius:3, width:`${(c/mx)*100}%` }} />
                </div>
              </div>
            })
        })()}
      </div>
    </div>
  </div>
}

// ══════════════════ USUÁRIOS ══════════════════
export function Usuarios() {
  const { data, loading, insert, update, remove } = useTable('usuarios', { order: 'nome', ascending: true })
  const { areas } = useLookups()
  const vp = useViewport()
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)

  const novo = () => { setItem({ nome:'', email:'', perfil:'operador', area_id:'', ativo:true }); setModal('novo') }
  const salvar = async () => {
    if (!(item.nome||'').trim()) return
    const p = { ...item }; delete p.id; delete p.created_at
    Object.keys(p).forEach(k => { if(p[k]==='') p[k]=null })
    if (item.id) await update(item.id, p); else await insert(p)
    setModal(null)
  }

  const perfilColor = { admin:'#EF4444', gestor:'#F59E0B', mecanico:'#3B82F6', operador:'#22C55E', visualizador:'#888' }

  if (loading) return <Loading />

  return <div>
    <Header title="USUÁRIOS" action={novo} label="+ NOVO USUÁRIO" mobile={vp.isMobile} />

    {data.length === 0 ? <Empty icon="👥" msg="Nenhum usuário cadastrado" action="Criar Usuário" onAction={novo} /> :
      <div style={{ display:'grid', gridTemplateColumns:vp.isMobile?'1fr':'repeat(auto-fill,minmax(340px,1fr))', gap:14 }}>
        {data.map(u => <div key={u.id} style={{ ...S.card, cursor:'pointer' }} onClick={() => { setItem({...u}); setModal('editar') }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontWeight:700, fontSize:15, color:'#E5E5E5' }}>{u.nome}</span>
            <span style={badge(u.ativo ? '#22C55E' : '#EF4444')}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
          </div>
          <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>{u.email || 'Sem email'}</div>
          <div style={{ display:'flex', gap:8 }}>
            <span style={badge(perfilColor[u.perfil]||'#888')}>{u.perfil?.toUpperCase()}</span>
            {u.area_id && <span style={{ fontSize:11, color:'#666' }}>🏭 {areas.find(a=>a.id===u.area_id)?.nome||'—'}</span>}
          </div>
        </div>)}
      </div>
    }

    <Modal open={!!modal} onClose={() => setModal(null)} title={modal==='novo'?'NOVO USUÁRIO':'EDITAR USUÁRIO'} mobile={vp.isMobile}>
      {item && <div>
        <div style={{ display:'grid', gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr', gap:'0 16px' }}>
          <Field label="Nome" req><input style={S.input} value={item.nome||''} onChange={e=>setItem({...item,nome:e.target.value})} /></Field>
          <Field label="Email"><input style={S.input} type="email" value={item.email||''} onChange={e=>setItem({...item,email:e.target.value})} /></Field>
          <Field label="Perfil"><select style={S.select} value={item.perfil||'operador'} onChange={e=>setItem({...item,perfil:e.target.value})}>
            {PERFIS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </select></Field>
          <Field label="Área Pré-definida"><select style={S.select} value={item.area_id||''} onChange={e=>setItem({...item,area_id:e.target.value})}>
            <option value="">Todas (sem restrição)</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}
          </select></Field>
        </div>
        <Field label="Status"><label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', minHeight:44 }}>
          <input type="checkbox" checked={item.ativo!==false} onChange={e=>setItem({...item,ativo:e.target.checked})} style={{ width:20, height:20 }} />
          <span style={{ fontSize:14, color:item.ativo!==false?'#22C55E':'#EF4444' }}>{item.ativo!==false?'Ativo':'Inativo'}</span>
        </label></Field>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:20, paddingTop:16, borderTop:'1px solid #1F1F23', gap:10, flexWrap:'wrap' }}>
          {modal==='editar'&&<button style={S.btnD} onClick={async()=>{await remove(item.id);setModal(null)}}>Excluir</button>}
          <div style={{ display:'flex', gap:10, marginLeft:'auto' }}><button style={S.btnS} onClick={()=>setModal(null)}>Cancelar</button><button style={S.btnP} onClick={salvar}>Salvar</button></div>
        </div>
      </div>}
    </Modal>
  </div>
}
