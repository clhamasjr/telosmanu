import React, { useState, useMemo } from 'react'
import { useTable, useLookups, useViewport, useEquipPorArea, useOSPorMecanico } from '../hooks/useData'
import { S, badge, Modal, Field, Empty, Search, Confirm, Header, Loading, fmtDate, fmtDT } from '../components/UI'
import { EQUIP_STATUS, TURNOS, UNIDADES, ACCENT, FONT_DISPLAY } from '../lib/constants'
import { supabase } from '../lib/supabase'

// ══════════════════ EQUIPAMENTOS ══════════════════
export function Equipamentos() {
  const { data, loading, insert, update, remove, refetch } = useTable('equipamentos', { order: 'nome', ascending: true })
  const { areas } = useLookups()
  const vp = useViewport()
  const [search, setSearch] = useState('')
  const [fArea, setFA] = useState('TODOS')
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [histEquip, setHistEquip] = useState(null)

  const filtered = useMemo(() => data.filter(e => {
    if (fArea !== 'TODOS' && e.area_id !== fArea) return false
    if (search) { const s = search.toLowerCase(); return (e.nome||'').toLowerCase().includes(s)||(e.codigo||'').toLowerCase().includes(s)||(e.tag||'').toLowerCase().includes(s) }
    return true
  }), [data, search, fArea])

  const novo = () => { setItem({ nome:'', codigo:'', tag:'', area_id:'', fabricante:'', modelo:'', status:'Operando', localizacao:'', observacoes:'' }); setModal('novo') }
  const salvar = async () => {
    if (!(item.nome||'').trim()) return
    const p = { ...item }; delete p.id; delete p.created_at; delete p.updated_at
    Object.keys(p).forEach(k => { if (p[k]==='') p[k]=null })
    if (item.id) await update(item.id, p); else await insert(p)
    setModal(null)
  }

  if (loading) return <Loading />

  return <div>
    <Header title="EQUIPAMENTOS" action={novo} label="+ NOVO" mobile={vp.isMobile} />
    <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
      <Search value={search} onChange={setSearch} ph="Nome, código, TAG..." />
      <select style={{...S.select,width:160}} value={fArea} onChange={e=>setFA(e.target.value)}><option value="TODOS">Todas Áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select>
      <span style={{fontSize:11,color:'#555'}}>{filtered.length} equipamento(s)</span>
    </div>

    {filtered.length===0?<Empty icon="⚙️" msg="Nenhum equipamento" action="Cadastrar" onAction={novo}/>:
    <div style={{display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'repeat(auto-fill,minmax(320px,1fr))',gap:14}}>
      {filtered.map(e=>{
        const sc = e.status==='Operando'?'#22C55E':e.status==='Parado'?'#EF4444':'#F59E0B'
        return <div key={e.id} style={{...S.card,borderLeft:'3px solid '+sc}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontWeight:700,color:'#E5E5E5',fontSize:14}}>{e.nome}</span>
            <span style={badge(sc)}>{e.status}</span>
          </div>
          {e.codigo&&<div style={{fontSize:12,color:ACCENT,marginBottom:4}}>COD: {e.codigo}</div>}
          {e.tag&&<div style={{fontSize:12,color:'#888',marginBottom:4}}>TAG: {e.tag}</div>}
          <div style={{fontSize:12,color:'#888',marginBottom:8}}>{areas.find(a=>a.id===e.area_id)?.nome||'Sem área'}{e.fabricante?' · '+e.fabricante:''}</div>
          <div style={{display:'flex',gap:6}}>
            <button style={{...S.btnS,flex:1,fontSize:11}} onClick={()=>setHistEquip(e)}>📊 Histórico</button>
            <button style={{...S.btnS,fontSize:11}} onClick={()=>{setItem({...e});setModal('editar')}}>✏️ Editar</button>
          </div>
        </div>
      })}
    </div>}

    <Modal open={!!modal} onClose={()=>setModal(null)} title={modal==='novo'?'NOVO EQUIPAMENTO':'EDITAR EQUIPAMENTO'} mobile={vp.isMobile}>
      {item&&<div>
        <div style={{display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr',gap:'0 16px'}}>
          <Field label="Nome" req><input style={S.input} value={item.nome||''} onChange={e=>setItem({...item,nome:e.target.value})} placeholder="Nome do equipamento"/></Field>
          <Field label="Código"><input style={S.input} value={item.codigo||''} onChange={e=>setItem({...item,codigo:e.target.value})}/></Field>
          <Field label="TAG"><input style={S.input} value={item.tag||''} onChange={e=>setItem({...item,tag:e.target.value})}/></Field>
          <Field label="Área"><select style={S.select} value={item.area_id||''} onChange={e=>setItem({...item,area_id:e.target.value})}><option value="">Selecione</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>
          <Field label="Status"><select style={S.select} value={item.status||'Operando'} onChange={e=>setItem({...item,status:e.target.value})}>{EQUIP_STATUS.map(s=><option key={s}>{s}</option>)}</select></Field>
          <Field label="Fabricante"><input style={S.input} value={item.fabricante||''} onChange={e=>setItem({...item,fabricante:e.target.value})}/></Field>
          <Field label="Modelo"><input style={S.input} value={item.modelo||''} onChange={e=>setItem({...item,modelo:e.target.value})}/></Field>
          <Field label="Localização"><input style={S.input} value={item.localizacao||''} onChange={e=>setItem({...item,localizacao:e.target.value})}/></Field>
        </div>
        <Field label="Observações"><textarea style={{...S.input,minHeight:60,resize:'vertical'}} value={item.observacoes||''} onChange={e=>setItem({...item,observacoes:e.target.value})}/></Field>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:20,paddingTop:16,borderTop:'1px solid #1F1F23',gap:10,flexWrap:'wrap'}}>
          {modal==='editar'&&<button style={S.btnD} onClick={()=>setConfirm({msg:'Excluir?',ok:async()=>{await remove(item.id);setConfirm(null);setModal(null)}})}>Excluir</button>}
          <div style={{display:'flex',gap:10,marginLeft:'auto'}}><button style={S.btnS} onClick={()=>setModal(null)}>Cancelar</button><button style={S.btnP} onClick={salvar}>Salvar</button></div>
        </div>
      </div>}
    </Modal>
    <Modal open={!!histEquip} onClose={()=>setHistEquip(null)} title={`📊 ${histEquip?.nome||''}`} mobile={vp.isMobile}>
      {histEquip&&<EquipHistorico equip={histEquip}/>}
    </Modal>
    <Confirm open={!!confirm} msg={confirm?.msg} onOk={confirm?.ok} onNo={()=>setConfirm(null)}/>
  </div>
}

function EquipHistorico({ equip }) {
  const [data, setData] = React.useState({ loading: true, os: [], pecas: [] })
  React.useEffect(() => {
    (async () => {
      let allOS = [], pg = 0
      while (true) {
        const { data: rows } = await supabase.from('ordens_servico')
          .select('id,titulo,data_abertura,data_conclusao,data_inicio,tempo_execucao_min,tempo_atendimento_min,executado_por,status_os(nome,cor,icone),tipos_manutencao(nome),tipos_falha(nome)')
          .eq('equipamento_id', equip.id).order('data_abertura',{ascending:false}).range(pg*500,(pg+1)*500-1)
        if (!rows||rows.length===0) break; allOS=allOS.concat(rows)
        if (rows.length<500) break; pg++; if(pg>20) break
      }
      let pecas = []
      try { const { data: p } = await supabase.from('equipamento_materiais').select('*,materiais(nome,codigo,quantidade,unidade)').eq('equipamento_id',equip.id); pecas=p||[] } catch(e){}
      setData({ loading:false, os:allOS, pecas })
    })()
  }, [equip.id])
  
  if (data.loading) return <div style={{textAlign:'center',padding:30,color:'#666'}}>Carregando...</div>
  const totalOS=data.os.length, concl=data.os.filter(o=>o.status_os?.nome==='Concluída').length
  const paradas=data.os.filter(o=>o.tempo_execucao_min>0).length
  const tMin=data.os.reduce((s,o)=>s+(o.tempo_execucao_min||0),0), tMed=paradas>0?tMin/paradas:0
  const falhaMap={}; data.os.forEach(o=>{const f=o.tipos_falha?.nome||o.tipos_manutencao?.nome||'Não classificada';falhaMap[f]=(falhaMap[f]||0)+1})
  const falhas=Object.entries(falhaMap).sort((a,b)=>b[1]-a[1])
  const anoMap={}; data.os.forEach(o=>{if(o.data_abertura){const y=o.data_abertura.substring(0,4);anoMap[y]=(anoMap[y]||0)+1}})
  
  return <div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
      {[['Total OS',totalOS,ACCENT],['Paradas',paradas,'#EF4444'],['Concluídas',concl,'#22C55E'],['T.Médio',`${tMed.toFixed(0)}min`,'#3B82F6']].map(([l,v,c])=>
        <div key={l} style={{background:'#1A1A1E',borderRadius:6,padding:8,textAlign:'center'}}>
          <div style={{fontSize:20,fontWeight:900,color:c}}>{v}</div>
          <div style={{fontSize:8,color:'#666',textTransform:'uppercase'}}>{l}</div>
        </div>)}
    </div>
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:'#888',textTransform:'uppercase',marginBottom:6,fontWeight:600}}>Motivos Recorrentes</div>
      {falhas.length===0?<div style={{color:'#555',fontSize:11}}>Sem dados</div>:
        falhas.slice(0,6).map(([f,c])=>{const mx=Math.max(...falhas.map(x=>x[1]));return<div key={f} style={{marginBottom:5}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:2}}><span style={{color:'#CCC'}}>{f}</span><span style={{color:ACCENT,fontWeight:700}}>{c}x</span></div>
          <div style={{background:'#1A1A1E',borderRadius:3,height:4}}><div style={{background:'linear-gradient(90deg,#EF4444,#F59E0B)',height:'100%',borderRadius:3,width:`${(c/mx)*100}%`}}/></div>
        </div>})}
    </div>
    {Object.keys(anoMap).length>0&&<div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:'#888',textTransform:'uppercase',marginBottom:6,fontWeight:600}}>OS por Ano</div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{Object.entries(anoMap).sort().map(([y,c])=>
        <div key={y} style={{background:'#1A1A1E',borderRadius:6,padding:'4px 10px',textAlign:'center'}}><div style={{fontSize:14,fontWeight:700,color:ACCENT}}>{c}</div><div style={{fontSize:8,color:'#666'}}>{y}</div></div>
      )}</div>
    </div>}
    {data.pecas.length>0&&<div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:'#888',textTransform:'uppercase',marginBottom:6,fontWeight:600}}>Peças Vinculadas ({data.pecas.length})</div>
      {data.pecas.map(p=><div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #1A1A1E',fontSize:11}}>
        <span style={{color:'#CCC'}}>{p.materiais?.nome} ({p.materiais?.codigo})</span>
        <span style={{color:'#888'}}>Estoque: <strong style={{color:(p.materiais?.quantidade||0)<=0?'#EF4444':ACCENT}}>{p.materiais?.quantidade||0}</strong></span>
      </div>)}
    </div>}
    <div>
      <div style={{fontSize:10,color:'#888',textTransform:'uppercase',marginBottom:6,fontWeight:600}}>Últimas OS ({Math.min(totalOS,30)})</div>
      <div style={{maxHeight:220,overflow:'auto'}}>{data.os.slice(0,30).map(o=><div key={o.id} style={{padding:'5px 0',borderBottom:'1px solid #1A1A1E',fontSize:11}}>
        <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#E5E5E5',fontWeight:600}}>{(o.titulo||'').substring(0,50)}</span><span style={{color:'#555'}}>{fmtDate(o.data_abertura)}</span></div>
        <div style={{color:'#888'}}>{o.status_os?.icone} {o.status_os?.nome}{o.tipos_falha?.nome?' · '+o.tipos_falha.nome:''}{o.tempo_execucao_min>0?' · '+o.tempo_execucao_min+'min':''}</div>
      </div>)}</div>
    </div>
  </div>
}

// ══════════════════ ÁREAS & EQUIPAMENTOS ══════════════════
export function Areas() {
  const { data, loading, insert, update, remove } = useTable('areas', { order: 'nome', ascending: true })
  const { data: allEquip } = useTable('equipamentos', { order: 'nome', ascending: true })
  const vp = useViewport()
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [selArea, setSelArea] = useState(null)
  const [histEquipArea, setHistEquipArea] = useState(null)

  const salvar = async () => {
    if (!(item.nome||'').trim()) return
    const p = { nome:item.nome, descricao:item.descricao||null, responsavel:item.responsavel||null }
    if (item.id) await update(item.id, p); else await insert(p)
    setModal(null)
  }

  const areaEquips = useMemo(() => {
    const map = {}
    allEquip.forEach(e => { const aid = e.area_id||'none'; if(!map[aid]) map[aid]=[]; map[aid].push(e) })
    return map
  }, [allEquip])

  if (loading) return <Loading />

  return <div>
    <Header title="ÁREAS & EQUIPAMENTOS" action={()=>{setItem({nome:'',descricao:'',responsavel:''});setModal('novo')}} label="+ NOVA ÁREA" mobile={vp.isMobile} />

    <div style={{display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
      {data.map(a=>{
        const eqs = areaEquips[a.id]||[]
        const operando = eqs.filter(e=>e.status==='Operando').length
        const parado = eqs.filter(e=>e.status!=='Operando').length
        return <div key={a.id} style={{...S.card,cursor:'pointer'}} onClick={()=>setSelArea(selArea===a.id?null:a.id)}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontFamily:FONT_DISPLAY,fontSize:20,letterSpacing:1,color:ACCENT,marginBottom:4}}>{a.nome}</div>
              <div style={{fontSize:12,color:'#888',marginBottom:8}}>{a.descricao||'Sem descrição'}</div>
            </div>
            <button style={{...S.btnS,padding:'4px 10px',minHeight:32,fontSize:11}} onClick={e=>{e.stopPropagation();setItem({...a});setModal('editar')}}>✏️</button>
          </div>
          <div style={{display:'flex',gap:12,fontSize:12}}>
            <span style={{color:'#22C55E'}}>✅ {operando} operando</span>
            {parado>0&&<span style={{color:'#EF4444'}}>⛔ {parado} parado(s)</span>}
            <span style={{color:'#888'}}>Total: {eqs.length}</span>
          </div>
          {a.responsavel&&<div style={{fontSize:11,color:'#666',marginTop:6}}>Resp.: {a.responsavel}</div>}

          {/* Lista de equipamentos expandida */}
          {selArea===a.id&&eqs.length>0&&<div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #1F1F23'}}>
            <div style={{fontSize:11,color:'#888',textTransform:'uppercase',marginBottom:8}}>Equipamentos desta área</div>
            {eqs.map(eq=>{
              const sc=eq.status==='Operando'?'#22C55E':eq.status==='Parado'?'#EF4444':'#F59E0B'
              return <div key={eq.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #1A1A1E',cursor:'pointer'}} onClick={e=>{e.stopPropagation();setHistEquipArea(eq)}}>
                <div><span style={{fontSize:13,color:'#E5E5E5',fontWeight:600}}>{eq.nome}</span>{eq.codigo&&<span style={{fontSize:11,color:ACCENT,marginLeft:8}}>({eq.codigo})</span>}</div>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span style={badge(sc)}>{eq.status}</span>
                  <span style={{fontSize:10,color:'#3B82F6'}}>📊</span>
                </div>
              </div>
            })}
          </div>}
          {selArea===a.id&&eqs.length===0&&<div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #1F1F23',fontSize:12,color:'#555'}}>Nenhum equipamento nesta área</div>}
        </div>
      })}
    </div>

    <Modal open={!!modal} onClose={()=>setModal(null)} title={modal==='novo'?'NOVA ÁREA':'EDITAR ÁREA'} mobile={vp.isMobile}>
      {item&&<div>
        <Field label="Nome" req><input style={S.input} value={item.nome||''} onChange={e=>setItem({...item,nome:e.target.value})}/></Field>
        <Field label="Descrição"><textarea style={{...S.input,minHeight:60,resize:'vertical'}} value={item.descricao||''} onChange={e=>setItem({...item,descricao:e.target.value})}/></Field>
        <Field label="Responsável"><input style={S.input} value={item.responsavel||''} onChange={e=>setItem({...item,responsavel:e.target.value})}/></Field>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:20,paddingTop:16,borderTop:'1px solid #1F1F23',gap:10,flexWrap:'wrap'}}>
          {modal==='editar'&&<button style={S.btnD} onClick={()=>setConfirm({msg:'Excluir área?',ok:async()=>{await remove(item.id);setConfirm(null);setModal(null)}})}>Excluir</button>}
          <div style={{display:'flex',gap:10,marginLeft:'auto'}}><button style={S.btnS} onClick={()=>setModal(null)}>Cancelar</button><button style={S.btnP} onClick={salvar}>Salvar</button></div>
        </div>
      </div>}
    </Modal>
    <Modal open={!!histEquipArea} onClose={()=>setHistEquipArea(null)} title={`📊 ${histEquipArea?.nome||''}`} mobile={vp.isMobile}>
      {histEquipArea&&<EquipHistorico equip={histEquipArea}/>}
    </Modal>
    <Confirm open={!!confirm} msg={confirm?.msg} onOk={confirm?.ok} onNo={()=>setConfirm(null)}/>
  </div>
}

// ══════════════════ MECÂNICOS COM HISTÓRICO ══════════════════
export function Mecanicos() {
  const { data, loading, insert, update, remove } = useTable('mecanicos', { order: 'nome', ascending: true })
  const { areas } = useLookups()
  const vp = useViewport()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detailMec, setDetailMec] = useState(null)
  const [periodo, setPeriodo] = useState({ from:'2024-01-01', to:new Date().toISOString().split('T')[0] })

  const filtered = data.filter(m=>{if(!search)return true;const s=search.toLowerCase();return(m.nome||'').toLowerCase().includes(s)||(m.matricula||'').toLowerCase().includes(s)})
  const novo = ()=>{setItem({nome:'',matricula:'',especialidade:'',telefone:'',area_id:'',turno:'A',ativo:true,custo_hora:0});setModal('novo')}
  const salvar = async()=>{
    if(!(item.nome||'').trim())return
    const p={...item};delete p.id;delete p.created_at;delete p.updated_at
    Object.keys(p).forEach(k=>{if(p[k]==='')p[k]=null})
    if(item.id)await update(item.id,p);else await insert(p)
    setModal(null)
  }

  if(loading) return <Loading/>

  return <div>
    <Header title="MECÂNICOS" action={novo} label="+ NOVO" mobile={vp.isMobile}/>
    <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
      <Search value={search} onChange={setSearch} ph="Nome, matrícula..."/>
      <span style={{fontSize:11,color:'#555',whiteSpace:'nowrap'}}>{filtered.filter(m=>m.ativo).length} ativo(s)</span>
    </div>

    {filtered.length===0?<Empty icon="👨‍🔧" msg="Nenhum mecânico" action="Cadastrar" onAction={novo}/>:
      <div style={{display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'repeat(auto-fill,minmax(340px,1fr))',gap:14}}>
        {filtered.map(m=><div key={m.id} style={{...S.card}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:15,color:'#E5E5E5'}}>{m.nome}</span>
            <span style={badge(m.ativo?'#22C55E':'#EF4444')}>{m.ativo?'Ativo':'Inativo'}</span>
          </div>
          <div style={{fontSize:12,color:'#999',marginBottom:8}}>
            Mat: <strong style={{color:ACCENT}}>{m.matricula||'—'}</strong> · {m.especialidade||'—'} · Turno {m.turno||'—'}
            {m.custo_hora>0&&<span> · R$ {m.custo_hora}/h</span>}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button style={{...S.btnS,flex:1,fontSize:12}} onClick={()=>setDetailMec(m)}>📊 Histórico OS</button>
            <button style={{...S.btnS,fontSize:12}} onClick={()=>{setItem({...m});setModal('editar')}}>✏️ Editar</button>
          </div>
        </div>)}
      </div>
    }

    {/* Modal histórico do mecânico */}
    <Modal open={!!detailMec} onClose={()=>setDetailMec(null)} title={`📊 ${detailMec?.nome} - Histórico`} mobile={vp.isMobile}>
      {detailMec&&<MecDetalhe nome={detailMec.nome} periodo={periodo} setPeriodo={setPeriodo}/>}
    </Modal>

    <Modal open={!!modal} onClose={()=>setModal(null)} title={modal==='novo'?'NOVO MECÂNICO':'EDITAR MECÂNICO'} mobile={vp.isMobile}>
      {item&&<div>
        <div style={{display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr',gap:'0 16px'}}>
          <Field label="Nome" req><input style={S.input} value={item.nome||''} onChange={e=>setItem({...item,nome:e.target.value})}/></Field>
          <Field label="Matrícula"><input style={S.input} value={item.matricula||''} onChange={e=>setItem({...item,matricula:e.target.value})}/></Field>
          <Field label="Especialidade"><input style={S.input} value={item.especialidade||''} onChange={e=>setItem({...item,especialidade:e.target.value})} placeholder="Elétrica, Mecânica..."/></Field>
          <Field label="Telefone"><input style={S.input} value={item.telefone||''} onChange={e=>setItem({...item,telefone:e.target.value})}/></Field>
          <Field label="Área"><select style={S.select} value={item.area_id||''} onChange={e=>setItem({...item,area_id:e.target.value})}><option value="">Selecione</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>
          <Field label="Turno"><select style={S.select} value={item.turno||'A'} onChange={e=>setItem({...item,turno:e.target.value})}>{TURNOS.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</select></Field>
          <Field label="Custo/Hora (R$)"><input style={S.input} type="number" min="0" step="0.01" value={item.custo_hora||0} onChange={e=>setItem({...item,custo_hora:parseFloat(e.target.value)||0})}/></Field>
        </div>
        <Field label="Status"><label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',minHeight:44}}>
          <input type="checkbox" checked={item.ativo!==false} onChange={e=>setItem({...item,ativo:e.target.checked})} style={{width:20,height:20}}/>
          <span style={{fontSize:14,color:item.ativo!==false?'#22C55E':'#EF4444'}}>{item.ativo!==false?'Ativo':'Inativo'}</span>
        </label></Field>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:20,paddingTop:16,borderTop:'1px solid #1F1F23',gap:10,flexWrap:'wrap'}}>
          {modal==='editar'&&<button style={S.btnD} onClick={()=>setConfirm({msg:'Excluir?',ok:async()=>{await remove(item.id);setConfirm(null);setModal(null)}})}>Excluir</button>}
          <div style={{display:'flex',gap:10,marginLeft:'auto'}}><button style={S.btnS} onClick={()=>setModal(null)}>Cancelar</button><button style={S.btnP} onClick={salvar}>Salvar</button></div>
        </div>
      </div>}
    </Modal>
    <Confirm open={!!confirm} msg={confirm?.msg} onOk={confirm?.ok} onNo={()=>setConfirm(null)}/>
  </div>
}

function MecDetalhe({ nome, periodo, setPeriodo }) {
  const { data: osList, loading } = useOSPorMecanico(nome, periodo)
  const totalHoras = osList.reduce((s,o) => s + (o.tempo_execucao_min||0), 0)

  return <div>
    <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
      <Field label="De"><input style={{...S.input,width:150}} type="date" value={periodo.from} onChange={e=>setPeriodo({...periodo,from:e.target.value})}/></Field>
      <Field label="Até"><input style={{...S.input,width:150}} type="date" value={periodo.to} onChange={e=>setPeriodo({...periodo,to:e.target.value})}/></Field>
    </div>
    <div style={{display:'flex',gap:12,marginBottom:16}}>
      <div style={{background:'#1A1A1E',borderRadius:8,padding:'10px 16px',flex:1,textAlign:'center'}}>
        <div style={{fontSize:24,fontWeight:700,color:ACCENT}}>{osList.length}</div>
        <div style={{fontSize:10,color:'#666',textTransform:'uppercase'}}>OS Atendidas</div>
      </div>
      <div style={{background:'#1A1A1E',borderRadius:8,padding:'10px 16px',flex:1,textAlign:'center'}}>
        <div style={{fontSize:24,fontWeight:700,color:'#3B82F6'}}>{Math.floor(totalHoras/60)}h{String(totalHoras%60).padStart(2,'0')}</div>
        <div style={{fontSize:10,color:'#666',textTransform:'uppercase'}}>Horas Totais</div>
      </div>
    </div>
    {loading?<div style={{color:'#666',textAlign:'center',padding:20}}>Carregando...</div>:
      osList.length===0?<div style={{color:'#555',textAlign:'center',padding:20}}>Nenhuma OS no período</div>:
      <div style={{maxHeight:300,overflow:'auto'}}>{osList.map(o=>
        <div key={o.id} style={{padding:'8px 0',borderBottom:'1px solid #1A1A1E',fontSize:12}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:'#E5E5E5',fontWeight:600}}>{o.titulo||'OS'}</span>
            <span style={{color:'#888'}}>{fmtDate(o.data_abertura)}</span>
          </div>
          <div style={{display:'flex',gap:8,color:'#888'}}>
            <span>{o.areas?.nome||'—'}</span>
            <span>{o.equipamentos?.nome||''}</span>
            {o.tempo_execucao_min>0&&<span style={{color:'#3B82F6'}}>{o.tempo_execucao_min}min</span>}
          </div>
        </div>
      )}</div>
    }
  </div>
}

// ══════════════════ ESTOQUE ══════════════════
export function Pecas() {
  const { data, loading, insert, update, remove, refetch } = useTable('materiais', { order: 'nome', ascending: true })
  const vp = useViewport()
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('TODOS')
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [movModal, setMovModal] = useState(null)
  const [movQtd, setMovQtd] = useState(1)
  const [movObs, setMovObs] = useState('')
  const [importModal, setImportModal] = useState(false)
  const [importData, setImportData] = useState([])
  const [importStatus, setImportStatus] = useState('')
  const [matDetail, setMatDetail] = useState(null)

  const filtered = data.filter(p=>{
    if(filtro==='BAIXO'&&p.quantidade>p.estoque_minimo)return false
    if(filtro==='ZERADO'&&p.quantidade>0)return false
    if(search){const s=search.toLowerCase();return(p.nome||'').toLowerCase().includes(s)||(p.codigo||'').toLowerCase().includes(s)}
    return true
  })

  const nova=()=>{setItem({nome:'',codigo:'',categoria:'',unidade:'UN',quantidade:0,estoque_minimo:5,localizacao:''});setModal('novo')}
  const salvar=async()=>{
    if(!(item.nome||'').trim())return
    const p={...item};delete p.id;delete p.created_at;delete p.updated_at
    Object.keys(p).forEach(k=>{if(p[k]==='')p[k]=null})
    if(item.id)await update(item.id,p);else await insert(p)
    setModal(null)
  }
  const registrarMov=async(tipo)=>{
    if(movQtd<=0)return
    const p=data.find(x=>x.id===movModal);if(!p)return
    const nq=tipo==='entrada'?p.quantidade+movQtd:Math.max(0,p.quantidade-movQtd)
    await supabase.from('movimentacao_estoque').insert({material_id:p.id,tipo,quantidade:movQtd,observacoes:movObs||null,usuario:'Operador'})
    await update(p.id,{quantidade:nq})
    setMovModal(null);setMovQtd(1);setMovObs('')
  }

  // ── EXPORTAR CSV ──
  const exportCSV = () => {
    const headers = ['codigo','nome','categoria','unidade','quantidade','estoque_minimo','localizacao']
    const rows = data.map(p => headers.map(h => {
      const v = p[h]
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s
    }).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `estoque_telos_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── IMPORTAR CSV ──
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { setImportStatus('Arquivo vazio ou sem dados'); return }
      
      // Parse header
      const headerLine = lines[0].toLowerCase()
      const headers = parseCSVLine(headerLine)
      
      // Map columns
      const colMap = {}
      const synonyms = {
        codigo: ['codigo','código','cod','code','sku'],
        nome: ['nome','name','descricao','descrição','material','item','peça','peca'],
        categoria: ['categoria','category','grupo','group','tipo','type'],
        unidade: ['unidade','un','unit','uom','medida'],
        quantidade: ['quantidade','qtd','qty','qtde','estoque','stock'],
        estoque_minimo: ['estoque_minimo','minimo','mínimo','min','estoque_min','reposição','reposicao'],
        localizacao: ['localizacao','localização','local','location','endereco','endereço'],
      }
      headers.forEach((h, i) => {
        const clean = h.replace(/['"]/g,'').trim()
        for (const [field, syns] of Object.entries(synonyms)) {
          if (syns.some(s => clean.includes(s))) { colMap[field] = i; break }
        }
      })
      
      if (!colMap.nome && colMap.nome !== 0) {
        setImportStatus('Coluna "nome" não encontrada. Colunas detectadas: ' + headers.join(', '))
        return
      }
      
      // Parse data rows
      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i])
        const get = (field) => colMap[field] !== undefined ? (cols[colMap[field]] || '').replace(/^["']|["']$/g,'').trim() : ''
        const nome = get('nome')
        if (!nome) continue
        rows.push({
          codigo: get('codigo') || nome.substring(0,3).toUpperCase() + String(i).padStart(4,'0'),
          nome,
          categoria: get('categoria') || null,
          unidade: get('unidade') || 'UN',
          quantidade: parseFloat(get('quantidade')) || 0,
          estoque_minimo: parseFloat(get('estoque_minimo')) || 5,
          localizacao: get('localizacao') || null,
        })
      }
      setImportData(rows)
      setImportStatus(`${rows.length} itens detectados. Colunas: ${Object.keys(colMap).join(', ')}`)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const doImport = async () => {
    if (importData.length === 0) return
    setImportStatus('Importando...')
    let ok = 0, errs = 0
    for (let i = 0; i < importData.length; i += 20) {
      const batch = importData.slice(i, i + 20)
      const { error } = await supabase.from('materiais').upsert(batch, { onConflict: 'codigo', ignoreDuplicates: false })
      if (error) { errs += batch.length; console.error(error) } else ok += batch.length
    }
    setImportStatus(`Concluído: ${ok} importados, ${errs} erros`)
    if (ok > 0) await refetch()
  }

  if(loading) return <Loading/>

  return <div>
    {/* Header com botões */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
      <h1 style={{margin:0,fontFamily:FONT_DISPLAY,fontSize:vp.isMobile?22:30,letterSpacing:2,color:ACCENT}}>ESTOQUE DE PEÇAS</h1>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        <button style={{...S.btnS,fontSize:11,padding:'8px 12px'}} onClick={()=>{setImportModal(true);setImportData([]);setImportStatus('')}}>📥 Importar</button>
        <button style={{...S.btnS,fontSize:11,padding:'8px 12px'}} onClick={exportCSV}>📤 Exportar CSV</button>
        <button style={S.btnP} onClick={nova}>+ NOVA PEÇA</button>
      </div>
    </div>

    {/* Resumo */}
    <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
      <div style={{background:'#141416',border:'1px solid #1F1F23',borderRadius:8,padding:'8px 14px',fontSize:12}}>
        <span style={{color:'#888'}}>Total: </span><strong style={{color:'#E5E5E5'}}>{data.length}</strong>
      </div>
      <div style={{background:'#141416',border:'1px solid #1F1F23',borderRadius:8,padding:'8px 14px',fontSize:12}}>
        <span style={{color:'#888'}}>Baixo: </span><strong style={{color:'#F59E0B'}}>{data.filter(p=>p.quantidade<=p.estoque_minimo&&p.quantidade>0).length}</strong>
      </div>
      <div style={{background:'#141416',border:'1px solid #1F1F23',borderRadius:8,padding:'8px 14px',fontSize:12}}>
        <span style={{color:'#888'}}>Zerado: </span><strong style={{color:'#EF4444'}}>{data.filter(p=>p.quantidade===0).length}</strong>
      </div>
    </div>

    <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
      <Search value={search} onChange={setSearch} ph="Nome, código..."/>
      <select style={{...S.select,width:180}} value={filtro} onChange={e=>setFiltro(e.target.value)}><option value="TODOS">Todos</option><option value="BAIXO">⚠️ Estoque Baixo</option><option value="ZERADO">🔴 Zerado</option></select>
      <span style={{fontSize:10,color:'#555'}}>{filtered.length} itens</span>
    </div>

    {filtered.length===0?<Empty icon="📦" msg="Nenhuma peça" action="Cadastrar" onAction={nova}/>:
      vp.isMobile?<div style={{display:'flex',flexDirection:'column',gap:12}}>{filtered.map(p=>{
        const low=p.quantidade<=p.estoque_minimo,zero=p.quantidade===0
        return <div key={p.id} style={{...S.card,borderLeft:'3px solid '+(zero?'#EF4444':low?'#F59E0B':'#22C55E')}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontWeight:700,color:'#E5E5E5',fontSize:14,cursor:'pointer',textDecoration:'underline',textDecorationColor:'#333'}} onClick={e=>{e.stopPropagation();setMatDetail(p)}}>{p.nome}</span>
            {zero?<span style={badge('#EF4444')}>ZERADO</span>:low?<span style={badge('#F59E0B')}>BAIXO</span>:<span style={badge('#22C55E')}>OK</span>}
          </div>
          <div style={{fontSize:12,color:'#999',marginBottom:4}}>Cód: <strong style={{color:ACCENT}}>{p.codigo||'—'}</strong> · {p.unidade}</div>
          <div style={{fontSize:12,color:'#999',marginBottom:8}}>Qtd: <strong>{p.quantidade}</strong> / Mín: {p.estoque_minimo}{p.localizacao?' · '+p.localizacao:''}</div>
          <div style={{display:'flex',gap:8}}>
            <button style={{...S.btnS,flex:1,fontSize:12}} onClick={()=>{setMovModal(p.id);setMovQtd(1);setMovObs('')}}>📦 Movimentar</button>
            <button style={{...S.btnS,fontSize:12}} onClick={()=>{setItem({...p});setModal('editar')}}>✏️</button>
          </div>
        </div>
      })}</div>:
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>
        <th style={S.th}>Código</th><th style={S.th}>Nome</th><th style={S.th}>Cat.</th><th style={S.th}>Un.</th><th style={S.th}>Qtd</th><th style={S.th}>Mín</th><th style={S.th}>Local</th><th style={S.th}>Status</th><th style={S.th}>Ações</th>
      </tr></thead><tbody>{filtered.map(p=>{
        const low=p.quantidade<=p.estoque_minimo,zero=p.quantidade===0
        return <tr key={p.id}>
          <td style={{...S.td,color:ACCENT,fontWeight:700,fontSize:11}}>{p.codigo||'—'}</td>
          <td style={{...S.td,cursor:'pointer'}} onClick={()=>setMatDetail(p)}><span style={{borderBottom:'1px dashed #333'}}>{p.nome}</span></td>
          <td style={{...S.td,fontSize:11,color:'#888'}}>{p.categoria||'—'}</td>
          <td style={{...S.td,fontSize:11,color:'#888'}}>{p.unidade}</td>
          <td style={{...S.td,fontWeight:700,color:zero?'#EF4444':low?'#F59E0B':'#22C55E'}}>{p.quantidade}</td>
          <td style={{...S.td,color:'#666'}}>{p.estoque_minimo}</td>
          <td style={{...S.td,fontSize:11,color:'#888'}}>{p.localizacao||'—'}</td>
          <td style={S.td}>{zero?<span style={badge('#EF4444')}>ZERADO</span>:low?<span style={badge('#F59E0B')}>BAIXO</span>:<span style={badge('#22C55E')}>OK</span>}</td>
          <td style={S.td}><div style={{display:'flex',gap:4}}>
            <button style={{...S.btnS,padding:'4px 6px',minHeight:32,fontSize:11}} onClick={()=>{setMovModal(p.id);setMovQtd(1);setMovObs('')}} title="Movimentar">📦</button>
            <button style={{...S.btnS,padding:'4px 6px',minHeight:32,fontSize:11}} onClick={()=>{setItem({...p});setModal('editar')}} title="Editar">✏️</button>
          </div></td>
        </tr>
      })}</tbody></table></div>
    }

    {/* Modal Nova/Editar */}
    <Modal open={modal==='novo'||modal==='editar'} onClose={()=>setModal(null)} title={modal==='novo'?'NOVA PEÇA':'EDITAR PEÇA'} mobile={vp.isMobile}>
      {item&&<PecaForm item={item} setItem={setItem} modal={modal} onSave={salvar} onCancel={()=>setModal(null)}
        onDel={modal==='editar'?()=>setConfirm({msg:'Excluir?',ok:async()=>{await remove(item.id);setConfirm(null);setModal(null)}}):null}
        mobile={vp.isMobile}/>}
    </Modal>

    {/* Modal Movimentação */}
    <Modal open={!!movModal} onClose={()=>setMovModal(null)} title="MOVIMENTAÇÃO" mobile={vp.isMobile}>
      {movModal&&(()=>{const p=data.find(x=>x.id===movModal);if(!p)return null;return<div>
        <div style={{background:'#1A1A1E',padding:14,borderRadius:8,marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700}}>{p.nome}</div>
          <div style={{fontSize:13,color:'#888'}}>Cód: {p.codigo} · Estoque: <strong style={{color:ACCENT}}>{p.quantidade} {p.unidade}</strong></div>
        </div>
        <Field label="Quantidade"><input style={S.input} type="number" min="1" value={movQtd} onChange={e=>setMovQtd(parseInt(e.target.value)||0)}/></Field>
        <Field label="Observação"><input style={S.input} value={movObs} onChange={e=>setMovObs(e.target.value)} placeholder="OS vinculada, motivo..."/></Field>
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button style={{...S.btnP,flex:1,background:'#22C55E'}} onClick={()=>registrarMov('entrada')}>↓ ENTRADA</button>
          <button style={{...S.btnP,flex:1,background:'#EF4444'}} onClick={()=>registrarMov('saida')}>↑ SAÍDA</button>
        </div>
      </div>})()}
    </Modal>

    {/* Modal Importar */}
    <Modal open={importModal} onClose={()=>setImportModal(false)} title="📥 IMPORTAR ESTOQUE" mobile={vp.isMobile}>
      <div>
        <div style={{background:'#1A1A1E',borderRadius:8,padding:14,marginBottom:14,fontSize:12,color:'#CCC',lineHeight:1.8}}>
          <strong style={{color:ACCENT}}>Formato aceito:</strong> CSV com colunas (separado por vírgula)<br/>
          <strong>Obrigatório:</strong> nome<br/>
          <strong>Opcionais:</strong> codigo, categoria, unidade, quantidade, estoque_minimo, localizacao<br/>
          <div style={{marginTop:8,background:'#0A0A0B',borderRadius:6,padding:10,fontFamily:'monospace',fontSize:10,color:'#888'}}>
            codigo,nome,unidade,quantidade,estoque_minimo<br/>
            ROL001,Rolamento 6006 2Z,PC,10,5<br/>
            COR001,Corrente ASA 40,MT,25,10<br/>
            SEN001,Sensor Indutivo NF,PC,3,3
          </div>
        </div>
        
        <Field label="Arquivo CSV">
          <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload}
            style={{...S.input,padding:10,cursor:'pointer'}}/>
        </Field>
        
        {importStatus && <div style={{
          background:importStatus.includes('Concluído')?'#14532D':importStatus.includes('erro')||importStatus.includes('não')?'#5E1F1F':'#1E3A5F',
          border:'1px solid '+(importStatus.includes('Concluído')?'#22C55E':importStatus.includes('erro')?'#EF4444':'#3B82F6'),
          borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:11,
          color:importStatus.includes('Concluído')?'#22C55E':importStatus.includes('erro')?'#EF4444':'#93C5FD',
        }}>{importStatus}</div>}

        {importData.length > 0 && <>
          <div style={{fontSize:11,color:'#888',marginBottom:8}}>Pré-visualização ({importData.length} itens):</div>
          <div style={{maxHeight:200,overflow:'auto',background:'#0A0A0B',borderRadius:6,padding:8,marginBottom:14}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>
              <th style={{...S.th,padding:'6px 8px',fontSize:9}}>Código</th>
              <th style={{...S.th,padding:'6px 8px',fontSize:9}}>Nome</th>
              <th style={{...S.th,padding:'6px 8px',fontSize:9}}>Un</th>
              <th style={{...S.th,padding:'6px 8px',fontSize:9}}>Qtd</th>
              <th style={{...S.th,padding:'6px 8px',fontSize:9}}>Mín</th>
            </tr></thead><tbody>{importData.slice(0,20).map((r,i)=>
              <tr key={i}>
                <td style={{...S.td,padding:'4px 8px',fontSize:10,color:ACCENT}}>{r.codigo}</td>
                <td style={{...S.td,padding:'4px 8px',fontSize:10}}>{r.nome}</td>
                <td style={{...S.td,padding:'4px 8px',fontSize:10,color:'#888'}}>{r.unidade}</td>
                <td style={{...S.td,padding:'4px 8px',fontSize:10}}>{r.quantidade}</td>
                <td style={{...S.td,padding:'4px 8px',fontSize:10,color:'#888'}}>{r.estoque_minimo}</td>
              </tr>
            )}</tbody></table>
            {importData.length > 20 && <div style={{textAlign:'center',padding:6,color:'#666',fontSize:10}}>...e mais {importData.length-20} itens</div>}
          </div>
          <button style={S.btnP} onClick={doImport}>📥 IMPORTAR {importData.length} ITENS</button>
        </>}
      </div>
    </Modal>

    {/* Modal Histórico do Material */}
    <Modal open={!!matDetail} onClose={()=>setMatDetail(null)} title={`📦 ${matDetail?.nome||''}`} mobile={vp.isMobile}>
      {matDetail&&<MaterialHistorico mat={matDetail}/>}
    </Modal>

    <Confirm open={!!confirm} msg={confirm?.msg} onOk={confirm?.ok} onNo={()=>setConfirm(null)}/>
  </div>
}

// ══════════════════ FORMULÁRIO PEÇA COM EQUIPAMENTOS ══════════════════
function PecaForm({ item, setItem, modal, onSave, onCancel, onDel, mobile }) {
  const [eqSearch, setEqSearch] = useState('')
  const [linkedEquips, setLinkedEquips] = useState([]) // IDs of linked equipment
  const [allEquips, setAllEquips] = useState([])
  const [loadingEq, setLoadingEq] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load all equipment and current links
  React.useEffect(() => {
    (async () => {
      setLoadingEq(true)
      // All equipment
      let eqs = []
      let pg = 0
      while (true) {
        const { data: rows } = await supabase.from('equipamentos').select('id,nome,codigo,area_id').order('nome').range(pg*1000,(pg+1)*1000-1)
        if (!rows || rows.length === 0) break
        eqs = eqs.concat(rows)
        if (rows.length < 1000) break
        pg++
      }
      setAllEquips(eqs)

      // Current links for this material
      if (item.id) {
        try {
          const { data: links } = await supabase.from('equipamento_materiais').select('equipamento_id').eq('material_id', item.id)
          setLinkedEquips((links || []).map(l => l.equipamento_id))
        } catch(e) { setLinkedEquips([]) }
      }
      setLoadingEq(false)
    })()
  }, [item.id])

  const toggleEquip = (eqId) => {
    setLinkedEquips(prev => prev.includes(eqId) ? prev.filter(id => id !== eqId) : [...prev, eqId])
  }

  const handleSave = async () => {
    setSaving(true)
    // Save the material first
    await onSave()

    // If editing, sync equipment links
    if (item.id) {
      // Delete existing links
      await supabase.from('equipamento_materiais').delete().eq('material_id', item.id)
      // Insert new links
      if (linkedEquips.length > 0) {
        const links = linkedEquips.map(eqId => ({ material_id: item.id, equipamento_id: eqId, quantidade_padrao: 1 }))
        for (let i = 0; i < links.length; i += 50) {
          await supabase.from('equipamento_materiais').insert(links.slice(i, i + 50))
        }
      }
    }
    setSaving(false)
  }

  const filteredEquips = eqSearch
    ? allEquips.filter(e => (e.nome||'').toLowerCase().includes(eqSearch.toLowerCase()) || (e.codigo||'').toLowerCase().includes(eqSearch.toLowerCase()))
    : allEquips

  return <div>
    <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'0 16px'}}>
      <Field label="Código"><input style={S.input} value={item.codigo||''} onChange={e=>setItem({...item,codigo:e.target.value})}/></Field>
      <Field label="Nome" req><input style={S.input} value={item.nome||''} onChange={e=>setItem({...item,nome:e.target.value})}/></Field>
      <Field label="Categoria"><input style={S.input} value={item.categoria||''} onChange={e=>setItem({...item,categoria:e.target.value})}/></Field>
      <Field label="Unidade"><select style={S.select} value={item.unidade||'UN'} onChange={e=>setItem({...item,unidade:e.target.value})}>{UNIDADES.map(u=><option key={u}>{u}</option>)}</select></Field>
      <Field label="Qtd"><input style={S.input} type="number" min="0" value={item.quantidade||0} onChange={e=>setItem({...item,quantidade:parseFloat(e.target.value)||0})}/></Field>
      <Field label="Mínimo"><input style={S.input} type="number" min="0" value={item.estoque_minimo||0} onChange={e=>setItem({...item,estoque_minimo:parseFloat(e.target.value)||0})}/></Field>
      <Field label="Localização"><input style={S.input} value={item.localizacao||''} onChange={e=>setItem({...item,localizacao:e.target.value})}/></Field>
    </div>

    {/* Equipment multi-select */}
    <div style={{marginTop:16,background:'#1A1A1E',borderRadius:8,padding:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontSize:11,color:'#888',textTransform:'uppercase',fontWeight:600}}>
          ⚙️ Equipamentos Aplicáveis ({linkedEquips.length} selecionados)
        </span>
      </div>

      {/* Selected chips */}
      {linkedEquips.length > 0 && <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
        {linkedEquips.map(eqId => {
          const eq = allEquips.find(e => e.id === eqId)
          return eq ? <span key={eqId} style={{
            display:'inline-flex',alignItems:'center',gap:4,
            background:ACCENT+'20',color:ACCENT,borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:600,
          }}>
            {eq.nome}{eq.codigo?` (${eq.codigo})`:''} 
            <span style={{cursor:'pointer',marginLeft:4,color:'#EF4444',fontSize:13}} onClick={()=>toggleEquip(eqId)}>✕</span>
          </span> : null
        })}
      </div>}

      {/* Search */}
      <input style={{...S.input,marginBottom:8,fontSize:12}} value={eqSearch} onChange={e=>setEqSearch(e.target.value)} placeholder="Buscar equipamento para vincular..."/>

      {/* Equipment list with checkboxes */}
      {loadingEq ? <div style={{color:'#666',fontSize:11,padding:10,textAlign:'center'}}>Carregando equipamentos...</div> :
        <div style={{maxHeight:200,overflow:'auto',border:'1px solid #222',borderRadius:6}}>
          {filteredEquips.slice(0,50).map(eq => {
            const checked = linkedEquips.includes(eq.id)
            return <label key={eq.id} style={{
              display:'flex',alignItems:'center',gap:10,padding:'7px 10px',cursor:'pointer',
              borderBottom:'1px solid #1A1A1E',
              background:checked?ACCENT+'10':'transparent',
            }}>
              <input type="checkbox" checked={checked} onChange={()=>toggleEquip(eq.id)}
                style={{width:16,height:16,accentColor:ACCENT,cursor:'pointer'}}/>
              <div style={{flex:1}}>
                <span style={{fontSize:12,color:checked?ACCENT:'#CCC',fontWeight:checked?600:400}}>{eq.nome}</span>
                {eq.codigo&&<span style={{fontSize:10,color:'#666',marginLeft:6}}>({eq.codigo})</span>}
              </div>
            </label>
          })}
          {filteredEquips.length > 50 && <div style={{padding:8,textAlign:'center',fontSize:10,color:'#666'}}>
            Mostrando 50 de {filteredEquips.length} — refine a busca
          </div>}
          {filteredEquips.length === 0 && <div style={{padding:12,textAlign:'center',fontSize:11,color:'#555'}}>
            {eqSearch ? 'Nenhum equipamento encontrado' : 'Nenhum equipamento cadastrado'}
          </div>}
        </div>
      }
    </div>

    <div style={{display:'flex',justifyContent:'space-between',marginTop:20,paddingTop:16,borderTop:'1px solid #1F1F23',gap:10,flexWrap:'wrap'}}>
      {onDel&&<button style={S.btnD} onClick={onDel}>Excluir</button>}
      <div style={{display:'flex',gap:10,marginLeft:'auto'}}>
        <button style={S.btnS} onClick={onCancel}>Cancelar</button>
        <button style={{...S.btnP,opacity:saving?.4:1}} onClick={handleSave} disabled={saving}>
          {saving?'Salvando...':modal==='novo'?'Criar Peça':'Salvar'}
        </button>
      </div>
    </div>
  </div>
}

// CSV line parser (handles quotes)
function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQuotes = !inQuotes }
    else if ((c === ',' || c === ';' || c === '\t') && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += c }
  }
  result.push(current.trim())
  return result
}

// ══════════════════ HISTÓRICO DO MATERIAL ══════════════════
function MaterialHistorico({ mat }) {
  const [data, setData] = React.useState({ loading: true, movs: [], osUso: [], equipVinc: [] })

  React.useEffect(() => {
    (async () => {
      // Movimentações de estoque
      const { data: movs } = await supabase.from('movimentacao_estoque')
        .select('*').eq('material_id', mat.id).order('created_at', { ascending: false }).limit(100)

      // OS que usaram este material
      const { data: osUso } = await supabase.from('os_materiais')
        .select('*, ordens_servico(titulo,data_abertura,equipamento_id,equipamentos(nome,codigo),areas(nome),status_os(nome,icone))')
        .eq('material_id', mat.id).order('created_at', { ascending: false }).limit(100)

      // Equipamentos vinculados (tabela equipamento_materiais)
      let equipVinc = []
      try {
        const { data: ev } = await supabase.from('equipamento_materiais')
          .select('*, equipamentos(nome,codigo,area_id,areas(nome))').eq('material_id', mat.id)
        equipVinc = ev || []
      } catch(e) {}

      // Também deduzir equipamentos pelo uso em OS
      const eqFromOS = {}
      ;(osUso || []).forEach(o => {
        const eq = o.ordens_servico?.equipamentos
        if (eq) {
          if (!eqFromOS[eq.nome]) eqFromOS[eq.nome] = { nome: eq.nome, codigo: eq.codigo, usos: 0, qtdTotal: 0 }
          eqFromOS[eq.nome].usos++
          eqFromOS[eq.nome].qtdTotal += o.quantidade || 0
        }
      })

      setData({
        loading: false,
        movs: movs || [],
        osUso: osUso || [],
        equipVinc,
        equipFromOS: Object.values(eqFromOS).sort((a, b) => b.usos - a.usos),
      })
    })()
  }, [mat.id])

  if (data.loading) return <div style={{ textAlign: 'center', padding: 30, color: '#666' }}>Carregando...</div>

  const totalEntradas = data.movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + (m.quantidade || 0), 0)
  const totalSaidas = data.movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + (m.quantidade || 0), 0)
  const totalUsadoOS = data.osUso.reduce((s, o) => s + (o.quantidade || 0), 0)

  return <div>
    {/* Info do material */}
    <div style={{ background: '#1A1A1E', borderRadius: 8, padding: 12, marginBottom: 14, borderLeft: `3px solid ${ACCENT}` }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: ACCENT }}>{mat.nome}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
        Código: <strong>{mat.codigo || '—'}</strong> · Unidade: {mat.unidade} · Local: {mat.localizacao || '—'}
      </div>
      <div style={{ fontSize: 13, color: '#E5E5E5', marginTop: 6 }}>
        Estoque atual: <strong style={{ color: mat.quantidade <= mat.estoque_minimo ? '#EF4444' : '#22C55E', fontSize: 18 }}>{mat.quantidade}</strong>
        <span style={{ color: '#666' }}> / mín: {mat.estoque_minimo}</span>
      </div>
    </div>

    {/* KPIs */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
      {[['Entradas', totalEntradas, '#22C55E'], ['Saídas', totalSaidas, '#EF4444'], ['Usado em OS', totalUsadoOS, '#3B82F6'], ['Máquinas', data.equipFromOS.length, ACCENT]].map(([l, v, c]) =>
        <div key={l} style={{ background: '#1A1A1E', borderRadius: 6, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: c }}>{v}</div>
          <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>{l}</div>
        </div>
      )}
    </div>

    {/* Equipamentos que usam este material */}
    {data.equipFromOS.length > 0 && <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>⚙️ Máquinas que Utilizam ({data.equipFromOS.length})</div>
      {data.equipFromOS.map(eq => (
        <div key={eq.nome} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1A1A1E' }}>
          <div>
            <span style={{ fontSize: 12, color: '#E5E5E5', fontWeight: 600 }}>{eq.nome}</span>
            {eq.codigo && <span style={{ fontSize: 10, color: ACCENT, marginLeft: 6 }}>({eq.codigo})</span>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 700 }}>{eq.usos}x</span>
            <span style={{ fontSize: 10, color: '#666', marginLeft: 6 }}>({eq.qtdTotal} {mat.unidade})</span>
          </div>
        </div>
      ))}
    </div>}

    {/* Vínculos cadastrados */}
    {data.equipVinc.length > 0 && <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>🔗 Vinculado a Equipamentos ({data.equipVinc.length})</div>
      {data.equipVinc.map(v => (
        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1A1A1E', fontSize: 11 }}>
          <span style={{ color: '#CCC' }}>{v.equipamentos?.nome} {v.equipamentos?.codigo ? `(${v.equipamentos.codigo})` : ''}</span>
          <span style={{ color: '#888' }}>Qtd padrão: {v.quantidade_padrao} · {v.equipamentos?.areas?.nome || ''}</span>
        </div>
      ))}
    </div>}

    {/* Uso em OS */}
    {data.osUso.length > 0 && <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>📋 Uso em Ordens de Serviço ({data.osUso.length})</div>
      <div style={{ maxHeight: 220, overflow: 'auto' }}>
        {data.osUso.map(o => (
          <div key={o.id} style={{ padding: '5px 0', borderBottom: '1px solid #1A1A1E', fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#E5E5E5', fontWeight: 600 }}>{(o.ordens_servico?.titulo || '').substring(0, 40)}</span>
              <span style={{ color: '#3B82F6', fontWeight: 700 }}>{o.quantidade} {mat.unidade}</span>
            </div>
            <div style={{ color: '#888' }}>
              {o.ordens_servico?.status_os?.icone} {o.ordens_servico?.areas?.nome || ''} · {o.ordens_servico?.equipamentos?.nome || ''} · {fmtDate(o.ordens_servico?.data_abertura)}
            </div>
          </div>
        ))}
      </div>
    </div>}

    {/* Movimentações */}
    {data.movs.length > 0 && <div>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>📊 Movimentações ({data.movs.length})</div>
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        {data.movs.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1E', fontSize: 11 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: m.tipo === 'entrada' ? '#22C55E' : '#EF4444', fontWeight: 700 }}>{m.tipo === 'entrada' ? '↓' : '↑'} {m.quantidade}</span>
              <span style={{ color: '#888' }}>{m.observacoes || ''}</span>
            </div>
            <span style={{ color: '#555' }}>{fmtDate(m.created_at)}</span>
          </div>
        ))}
      </div>
    </div>}

    {data.movs.length === 0 && data.osUso.length === 0 && data.equipFromOS.length === 0 &&
      <div style={{ textAlign: 'center', padding: 20, color: '#555', fontSize: 12 }}>Nenhum histórico de uso registrado ainda</div>}
  </div>
}
