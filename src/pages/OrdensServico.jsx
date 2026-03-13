import React, { useState, useMemo } from 'react'
import { useOrdens, useLookups, useOSHistorico, useViewport } from '../hooks/useData'
import { S, badge, StatusBadge, PrioBadge, Modal, Field, Empty, Search, Confirm, Header, Loading, fmtDate, fmtDT } from '../components/UI'
import { PRIORIDADES, PRIO_LABEL, ACCENT } from '../lib/constants'

export default function OrdensServico() {
  const { data:ordens, loading, insert, update, remove } = useOrdens()
  const { areas, statusList, tiposMan, tiposFalha, mecanicos, equipamentos } = useLookups()
  const vp = useViewport()
  const [search, setSearch] = useState('')
  const [fStatus, setFS] = useState('TODOS')
  const [fArea, setFA] = useState('TODOS')
  const [modal, setModal] = useState(null)
  const [os, setOs] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showF, setShowF] = useState(false)

  const filtered = useMemo(() => ordens.filter(o => {
    if (fStatus !== 'TODOS' && o.status_os?.id !== fStatus) return false
    if (fArea !== 'TODOS' && o.areas?.id !== fArea) return false
    if (search) { const s = search.toLowerCase(); return (o.titulo||'').toLowerCase().includes(s)||(o.numero_ordem_legado||'').includes(s)||(o.descricao||'').toLowerCase().includes(s)||(o.executado_por||'').toLowerCase().includes(s) }
    return true
  }), [ordens, search, fStatus, fArea])

  const novaOS = () => {
    setOs({ titulo:'', descricao:'', prioridade:'Media', status_id:statusList.find(s=>s.nome==='Aberta')?.id||'', area_id:'', equipamento_id:'', mecanico_responsavel_id:'', tipo_manutencao_id:'', tipo_falha_id:'', solicitante:'', observacoes:'' })
    setModal('nova')
  }

  const salvar = async () => {
    setSaving(true)
    const d = { ...os }; delete d.areas; delete d.equipamentos; delete d.mecanicos; delete d.status_os; delete d.tipos_manutencao; delete d.tipos_falha; delete d.os_historico
    Object.keys(d).forEach(k => { if (d[k] === '') d[k] = null })
    if (modal === 'nova') await insert(d)
    else {
      const old = ordens.find(o=>o.id===d.id)?.status_os?.nome
      const nw = statusList.find(s=>s.id===d.status_id)?.nome
      await update(d.id, d, old, nw)
    }
    setSaving(false); setModal(null)
  }

  if (loading) return <Loading />

  return <div>
    <Header title="ORDENS DE SERVIÇO" action={novaOS} label={vp.isMobile?'+ NOVA':'+ NOVA OS'} mobile={vp.isMobile} />
    <div style={{ display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center' }}>
      <Search value={search} onChange={setSearch} ph="Buscar nº, título, executor..." />
      {vp.isMobile ? <button style={S.btnS} onClick={()=>setShowF(!showF)}>🔽 Filtros</button> : <>
        <select style={{...S.select,width:180}} value={fStatus} onChange={e=>setFS(e.target.value)}><option value="TODOS">Todos Status</option>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select>
        <select style={{...S.select,width:160}} value={fArea} onChange={e=>setFA(e.target.value)}><option value="TODOS">Todas Áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select>
      </>}
      <span style={{ fontSize:11,color:'#555' }}>{filtered.length} resultado(s)</span>
    </div>
    {vp.isMobile && showF && <div style={{...S.card,display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
      <select style={S.select} value={fStatus} onChange={e=>setFS(e.target.value)}><option value="TODOS">Todos Status</option>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select>
      <select style={S.select} value={fArea} onChange={e=>setFA(e.target.value)}><option value="TODOS">Todas Áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select>
    </div>}

    {filtered.length===0 ? <Empty icon="📋" msg="Nenhuma OS" action="Criar OS" onAction={novaOS}/> :
      vp.isMobile ? <div style={{display:'flex',flexDirection:'column',gap:12}}>{filtered.map(o=>
        <div key={o.id} style={S.card} onClick={()=>{setOs({...o});setModal('ver')}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{color:ACCENT,fontWeight:700,fontSize:12}}>#{o.numero_ordem_legado||o.id.slice(0,6)}</span><PrioBadge p={o.prioridade}/></div>
          <div style={{fontSize:14,fontWeight:600,color:'#E5E5E5',marginBottom:6,lineHeight:1.3}}>{o.titulo||'Sem título'}</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><StatusBadge status={o.status_os}/><span style={{fontSize:12,color:'#888'}}>{o.areas?.nome||''}</span></div>
          {o.executado_por&&<div style={{fontSize:11,color:'#666',marginTop:4}}>👨‍🔧 {o.executado_por}</div>}
        </div>
      )}</div> :
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>
        <th style={S.th}>Nº</th><th style={S.th}>Título</th><th style={S.th}>Área</th><th style={S.th}>Equip.</th><th style={S.th}>Status</th><th style={S.th}>Prioridade</th><th style={S.th}>Executor</th><th style={S.th}>Data</th><th style={S.th}></th>
      </tr></thead><tbody>{filtered.map(o=>
        <tr key={o.id} style={{cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='#1A1A1E'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <td style={{...S.td,color:ACCENT,fontWeight:700}}>#{o.numero_ordem_legado||o.id.slice(0,6)}</td>
          <td style={{...S.td,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.titulo||'—'}</td>
          <td style={S.td}>{o.areas?.nome||'—'}</td>
          <td style={{...S.td,fontSize:12,color:'#999'}}>{o.equipamentos?.nome||'—'}</td>
          <td style={S.td}><StatusBadge status={o.status_os}/></td>
          <td style={S.td}><PrioBadge p={o.prioridade}/></td>
          <td style={{...S.td,fontSize:12,color:'#999'}}>{o.executado_por||'—'}</td>
          <td style={{...S.td,fontSize:12,color:'#999'}}>{fmtDate(o.data_abertura)}</td>
          <td style={S.td}><div style={{display:'flex',gap:6}}>
            <button style={{...S.btnS,padding:'6px 10px',minHeight:36}} onClick={e=>{e.stopPropagation();setOs({...o});setModal('ver')}}>👁</button>
            <button style={{...S.btnS,padding:'6px 10px',minHeight:36}} onClick={e=>{e.stopPropagation();setOs({...o});setModal('editar')}}>✏️</button>
          </div></td>
        </tr>
      )}</tbody></table></div>
    }

    <Modal open={modal==='nova'||modal==='editar'} onClose={()=>setModal(null)} title={modal==='nova'?'NOVA OS':'EDITAR OS'} mobile={vp.isMobile}>
      {os&&<OSForm os={os} setOs={setOs} onSave={salvar} onCancel={()=>setModal(null)} onDel={modal==='editar'?()=>setConfirm({msg:'Excluir OS?',ok:async()=>{await remove(os.id);setConfirm(null);setModal(null)}}):null}
        areas={areas} equipamentos={equipamentos} mecanicos={mecanicos} statusList={statusList} tiposMan={tiposMan} tiposFalha={tiposFalha} isEdit={modal==='editar'} saving={saving} mobile={vp.isMobile}/>}
    </Modal>
    <Modal open={modal==='ver'} onClose={()=>setModal(null)} title={`OS #${os?.numero_ordem_legado||''}`} mobile={vp.isMobile}>
      {os&&<OSDetail os={os} onEdit={()=>setModal('editar')} mobile={vp.isMobile}/>}
    </Modal>
    <Confirm open={!!confirm} msg={confirm?.msg} onOk={confirm?.ok} onNo={()=>setConfirm(null)}/>
  </div>
}

function OSForm({ os,setOs,onSave,onCancel,onDel,areas,equipamentos,mecanicos,statusList,tiposMan,tiposFalha,isEdit,saving,mobile }) {
  const u = (f,v)=>setOs({...os,[f]:v})
  const g = mobile?'1fr':'1fr 1fr'
  const ok = (os.titulo||'').trim()
  return <div>
    <div style={{display:'grid',gridTemplateColumns:g,gap:'0 16px'}}>
      <div style={{gridColumn:mobile?'auto':'span 2'}}><Field label="Título" req><input style={S.input} value={os.titulo||''} onChange={e=>u('titulo',e.target.value)} placeholder="Descreva o problema"/></Field></div>
      <Field label="Tipo Manutenção"><select style={S.select} value={os.tipo_manutencao_id||''} onChange={e=>u('tipo_manutencao_id',e.target.value)}><option value="">Selecione</option>{tiposMan.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>
      <Field label="Tipo Falha"><select style={S.select} value={os.tipo_falha_id||''} onChange={e=>u('tipo_falha_id',e.target.value)}><option value="">Selecione</option>{tiposFalha.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>
      <Field label="Área"><select style={S.select} value={os.area_id||''} onChange={e=>u('area_id',e.target.value)}><option value="">Selecione</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>
      <Field label="Equipamento"><select style={S.select} value={os.equipamento_id||''} onChange={e=>u('equipamento_id',e.target.value)}><option value="">Nenhum</option>{equipamentos.filter(eq=>!os.area_id||eq.area_id===os.area_id).map(e=><option key={e.id} value={e.id}>{e.nome}{e.codigo?` (${e.codigo})`:''}</option>)}</select></Field>
      <Field label="Prioridade"><select style={S.select} value={os.prioridade||'Media'} onChange={e=>u('prioridade',e.target.value)}>{Object.entries(PRIO_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
      {isEdit&&<Field label="Status"><select style={S.select} value={os.status_id||''} onChange={e=>u('status_id',e.target.value)}>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select></Field>}
      <Field label="Mecânico"><select style={S.select} value={os.mecanico_responsavel_id||''} onChange={e=>u('mecanico_responsavel_id',e.target.value)}><option value="">Não atribuído</option>{mecanicos.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></Field>
      <Field label="Solicitante"><input style={S.input} value={os.solicitante||''} onChange={e=>u('solicitante',e.target.value)}/></Field>
    </div>
    <Field label="Descrição"><textarea style={{...S.input,minHeight:80,resize:'vertical'}} value={os.descricao||''} onChange={e=>u('descricao',e.target.value)}/></Field>
    <Field label="Observações"><textarea style={{...S.input,minHeight:60,resize:'vertical'}} value={os.observacoes||''} onChange={e=>u('observacoes',e.target.value)}/></Field>
    <div style={{display:'flex',justifyContent:'space-between',marginTop:20,paddingTop:16,borderTop:'1px solid #1F1F23',gap:10,flexWrap:'wrap'}}>
      <div>{onDel&&<button style={S.btnD} onClick={onDel}>Excluir</button>}</div>
      <div style={{display:'flex',gap:10}}><button style={S.btnS} onClick={onCancel}>Cancelar</button><button style={{...S.btnP,opacity:ok&&!saving?1:.4}} onClick={ok?onSave:undefined} disabled={saving}>{saving?'Salvando...':isEdit?'Salvar':'Criar OS'}</button></div>
    </div>
  </div>
}

function OSDetail({ os, onEdit, mobile }) {
  const hist = useOSHistorico(os.id)
  return <div>
    <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
      <StatusBadge status={os.status_os}/><PrioBadge p={os.prioridade}/>
      {os.tipos_manutencao&&<span style={badge('#888')}>{os.tipos_manutencao.nome}</span>}
      {os.tipos_falha&&<span style={badge('#888')}>Falha: {os.tipos_falha.nome}</span>}
    </div>
    <h2 style={{margin:'0 0 16px',fontSize:16,color:'#E5E5E5',lineHeight:1.4}}>{os.titulo||'Sem título'}</h2>
    <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'10px 20px',marginBottom:16}}>
      {[['Área',os.areas?.nome],['Equipamento',os.equipamentos?`${os.equipamentos.nome} (${os.equipamentos.codigo||os.equipamentos.tag||''})`:null],
        ['Mecânico',os.mecanicos?.nome||'Não atribuído'],['Solicitante',os.solicitante],
        ['Executado por',os.executado_por],['Recebido por',os.recebido_por],
        ['Abertura',fmtDT(os.data_abertura)],['Conclusão',fmtDT(os.data_conclusao)],
      ].map(([l,v])=><div key={l}><div style={{fontSize:10,color:'#666',textTransform:'uppercase',marginBottom:3}}>{l}</div><div style={{fontSize:13,color:'#CCC'}}>{v||'—'}</div></div>)}
    </div>
    {os.descricao&&<div style={{marginBottom:16}}><div style={{fontSize:10,color:'#666',textTransform:'uppercase',marginBottom:6}}>Descrição</div><div style={{fontSize:13,color:'#CCC',lineHeight:1.6,background:'#1A1A1E',padding:12,borderRadius:8}}>{os.descricao}</div></div>}
    {os.descricao_execucao&&<div style={{marginBottom:16}}><div style={{fontSize:10,color:'#666',textTransform:'uppercase',marginBottom:6}}>Execução</div><div style={{fontSize:13,color:'#CCC',lineHeight:1.6,background:'#1A1A1E',padding:12,borderRadius:8}}>{os.descricao_execucao}</div></div>}
    {hist.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:10,color:'#666',textTransform:'uppercase',marginBottom:10}}>Histórico</div>
      <div style={{borderLeft:'2px solid #2A2A30',marginLeft:8,paddingLeft:16}}>{hist.map((h,i)=>
        <div key={h.id} style={{marginBottom:12,position:'relative'}}><div style={{position:'absolute',left:-22,top:4,width:8,height:8,borderRadius:'50%',background:i===0?ACCENT:'#2A2A30'}}/><div style={{fontSize:11,color:'#666'}}>{fmtDT(h.created_at)} — {h.usuario}</div><div style={{fontSize:12,color:'#CCC'}}>{h.acao}</div></div>
      )}</div></div>}
    <div style={{display:'flex',justifyContent:'flex-end',paddingTop:16,borderTop:'1px solid #1F1F23'}}><button style={S.btnP} onClick={onEdit}>✏️ Editar</button></div>
  </div>
}
