import React, { useState, useMemo, useEffect } from 'react'
import { useOrdens, useLookups, useOSHistorico, useViewport } from '../hooks/useData'
import { S, badge, StatusBadge, PrioBadge, Modal, Field, Empty, Search, Confirm, Header, Loading, fmtDate, fmtDT } from '../components/UI'
import { PRIORIDADES, PRIO_LABEL, ACCENT } from '../lib/constants'

export default function OrdensServico({ initialStatusFilter, onClearFilter }) {
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

  // Apply initial filter from Dashboard KPI click
  useEffect(() => {
    if (initialStatusFilter && statusList.length > 0) {
      const st = statusList.find(s => s.nome === initialStatusFilter)
      if (st) setFS(st.id)
    }
  }, [initialStatusFilter, statusList])

  const filtered = useMemo(() => ordens.filter(o => {
    if (fStatus !== 'TODOS' && o.status_os?.id !== fStatus) return false
    if (fArea !== 'TODOS' && o.areas?.id !== fArea) return false
    if (search) { const s = search.toLowerCase(); return (o.titulo||'').toLowerCase().includes(s)||(o.numero_ordem_legado||'').includes(s)||(o.descricao||'').toLowerCase().includes(s)||(o.executado_por||'').toLowerCase().includes(s)||(o.equipamentos?.nome||'').toLowerCase().includes(s) }
    return true
  }), [ordens, search, fStatus, fArea])

  const novaOS = () => {
    setOs({ titulo:'', descricao:'', prioridade:'Media', status_id:statusList.find(s=>s.nome==='Aberta')?.id||'', area_id:'', equipamento_id:'', mecanico_responsavel_id:'', tipo_manutencao_id:'', tipo_falha_id:'', solicitante:'', observacoes:'' })
    setModal('nova')
  }

  const salvar = async () => {
    setSaving(true)
    const d = { ...os }
    ;['areas','equipamentos','mecanicos','status_os','tipos_manutencao','tipos_falha','os_historico'].forEach(k => delete d[k])
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

  const activeFilterName = fStatus !== 'TODOS' ? statusList.find(s=>s.id===fStatus)?.nome : null

  return <div>
    <Header title="ORDENS DE SERVIÇO" action={novaOS} label={vp.isMobile?'+ NOVA':'+ NOVA OS'} mobile={vp.isMobile} />

    {/* Active filter banner */}
    {activeFilterName && <div style={{background:'#1E3A5F',border:'1px solid #3B82F6',borderRadius:8,padding:'10px 16px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:12,color:'#93C5FD'}}>Filtrado por: <strong>{activeFilterName}</strong> ({filtered.length} OS)</span>
      <button style={{...S.btnS,padding:'4px 10px',minHeight:28,fontSize:10}} onClick={()=>{setFS('TODOS');onClearFilter?.()}}>✕ Limpar filtro</button>
    </div>}

    <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
      <Search value={search} onChange={setSearch} ph="Buscar título, equipamento, executor..." />
      {vp.isMobile?<button style={S.btnS} onClick={()=>setShowF(!showF)}>🔽 Filtros</button>:<>
        <select style={{...S.select,width:180}} value={fStatus} onChange={e=>setFS(e.target.value)}><option value="TODOS">Todos Status</option>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select>
        <select style={{...S.select,width:160}} value={fArea} onChange={e=>setFA(e.target.value)}><option value="TODOS">Todas Áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select>
      </>}
      <span style={{fontSize:11,color:'#555'}}>{filtered.length} de {ordens.length}</span>
    </div>
    {vp.isMobile&&showF&&<div style={{...S.card,display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
      <select style={S.select} value={fStatus} onChange={e=>setFS(e.target.value)}><option value="TODOS">Todos Status</option>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select>
      <select style={S.select} value={fArea} onChange={e=>setFA(e.target.value)}><option value="TODOS">Todas Áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select>
    </div>}

    {filtered.length===0?<Empty icon="📋" msg="Nenhuma OS encontrada" action="Criar OS" onAction={novaOS}/>:
      vp.isMobile?<div style={{display:'flex',flexDirection:'column',gap:10}}>{filtered.slice(0,100).map(o=>
        <div key={o.id} style={S.card} onClick={()=>{setOs({...o});setModal('ver')}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><PrioBadge p={o.prioridade}/><span style={{fontSize:10,color:'#555'}}>{fmtDate(o.data_abertura)}</span></div>
          <div style={{fontSize:13,fontWeight:600,color:'#E5E5E5',marginBottom:4,lineHeight:1.3}}>{(o.titulo||'').substring(0,80)}</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            <StatusBadge status={o.status_os}/>
            <span style={{fontSize:11,color:'#888'}}>{o.areas?.nome||''}</span>
            {o.equipamentos?.nome&&<span style={{fontSize:10,color:ACCENT}}>⚙️ {o.equipamentos.nome}</span>}
          </div>
        </div>
      )}</div>:
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>
        <th style={S.th}>Título</th><th style={S.th}>Área</th><th style={S.th}>Equipamento</th><th style={S.th}>Status</th><th style={S.th}>Prioridade</th><th style={S.th}>Data</th><th style={S.th}></th>
      </tr></thead><tbody>{filtered.slice(0,200).map(o=>
        <tr key={o.id} style={{cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='#1A1A1E'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <td style={{...S.td,maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.titulo||'—'}</td>
          <td style={S.td}>{o.areas?.nome||'—'}</td>
          <td style={{...S.td,fontSize:12,color:ACCENT}}>{o.equipamentos?.nome||'—'}</td>
          <td style={S.td}><StatusBadge status={o.status_os}/></td>
          <td style={S.td}><PrioBadge p={o.prioridade}/></td>
          <td style={{...S.td,fontSize:11,color:'#999'}}>{fmtDate(o.data_abertura)}</td>
          <td style={S.td}><div style={{display:'flex',gap:4}}>
            <button style={{...S.btnS,padding:'4px 8px',minHeight:32}} onClick={e=>{e.stopPropagation();setOs({...o});setModal('ver')}}>👁</button>
            <button style={{...S.btnS,padding:'4px 8px',minHeight:32}} onClick={e=>{e.stopPropagation();setOs({...o});setModal('editar')}}>✏️</button>
          </div></td>
        </tr>
      )}</tbody></table>
      {filtered.length>200&&<div style={{textAlign:'center',padding:10,color:'#666',fontSize:11}}>Mostrando 200 de {filtered.length} — use filtros para refinar</div>}
      </div>
    }

    <Modal open={modal==='nova'||modal==='editar'} onClose={()=>setModal(null)} title={modal==='nova'?'NOVA OS':'EDITAR OS'} mobile={vp.isMobile}>
      {os&&<OSForm os={os} setOs={setOs} onSave={salvar} onCancel={()=>setModal(null)} onDel={modal==='editar'?()=>setConfirm({msg:'Excluir?',ok:async()=>{await remove(os.id);setConfirm(null);setModal(null)}}):null}
        areas={areas} equipamentos={equipamentos} mecanicos={mecanicos} statusList={statusList} tiposMan={tiposMan} tiposFalha={tiposFalha} isEdit={modal==='editar'} saving={saving} mobile={vp.isMobile}/>}
    </Modal>
    <Modal open={modal==='ver'} onClose={()=>setModal(null)} title={`OS — ${(os?.titulo||'').substring(0,40)}`} mobile={vp.isMobile}>
      {os&&<OSDetail os={os} onEdit={()=>setModal('editar')} mobile={vp.isMobile}/>}
    </Modal>
    <Confirm open={!!confirm} msg={confirm?.msg} onOk={confirm?.ok} onNo={()=>setConfirm(null)}/>
  </div>
}

function OSForm({os,setOs,onSave,onCancel,onDel,areas,equipamentos,mecanicos,statusList,tiposMan,tiposFalha,isEdit,saving,mobile}) {
  const u=(f,v)=>setOs({...os,[f]:v})
  const g=mobile?'1fr':'1fr 1fr'
  const canSave=(os.titulo||'').trim()&&(os.solicitante||'').trim()&&os.tipo_manutencao_id&&os.area_id
  const filteredEquip=useMemo(()=>{
    if(os.area_id){const ae=equipamentos.filter(e=>e.area_id===os.area_id);if(ae.length>0)return ae}
    return equipamentos
  },[equipamentos,os.area_id])
  const missing=[]
  if(!(os.titulo||'').trim()) missing.push('Título')
  if(!(os.solicitante||'').trim()) missing.push('Solicitante')
  if(!os.tipo_manutencao_id) missing.push('Tipo Manutenção')
  if(!os.area_id) missing.push('Área')

  return<div>
    <div style={{display:'grid',gridTemplateColumns:g,gap:'0 14px'}}>
      <div style={{gridColumn:mobile?'auto':'span 2'}}><Field label="Título" req><input style={S.input} value={os.titulo||''} onChange={e=>u('titulo',e.target.value)} placeholder="Descreva o problema"/></Field></div>
      <Field label="Solicitante" req><input style={S.input} value={os.solicitante||''} onChange={e=>u('solicitante',e.target.value)} placeholder="Quem solicitou"/></Field>
      <Field label="Tipo Manutenção" req><select style={{...S.select,borderColor:!os.tipo_manutencao_id?'#5E1F1F':undefined}} value={os.tipo_manutencao_id||''} onChange={e=>u('tipo_manutencao_id',e.target.value)}><option value="">Selecione *</option>{tiposMan.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>
      <Field label="Tipo Falha"><select style={S.select} value={os.tipo_falha_id||''} onChange={e=>u('tipo_falha_id',e.target.value)}><option value="">Selecione</option>{tiposFalha.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>
      <Field label="Área" req><select style={{...S.select,borderColor:!os.area_id?'#5E1F1F':undefined}} value={os.area_id||''} onChange={e=>u('area_id',e.target.value)}><option value="">Selecione *</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>
      <Field label={`Equipamento (${filteredEquip.length})`}><select style={S.select} value={os.equipamento_id||''} onChange={e=>u('equipamento_id',e.target.value)}>
        <option value="">Selecione</option>{filteredEquip.map(e=><option key={e.id} value={e.id}>{e.nome}{e.codigo?` (${e.codigo})`:''}</option>)}
      </select></Field>
      <Field label="Prioridade"><select style={S.select} value={os.prioridade||'Media'} onChange={e=>u('prioridade',e.target.value)}>{Object.entries(PRIO_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
      {isEdit&&<Field label="Status"><select style={S.select} value={os.status_id||''} onChange={e=>u('status_id',e.target.value)}>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select></Field>}
      <Field label="Mecânico"><select style={S.select} value={os.mecanico_responsavel_id||''} onChange={e=>u('mecanico_responsavel_id',e.target.value)}><option value="">Não atribuído</option>{mecanicos.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></Field>
    </div>
    <Field label="Descrição do Serviço" req><textarea style={{...S.input,minHeight:70,resize:'vertical'}} value={os.descricao||''} onChange={e=>u('descricao',e.target.value)} placeholder="Descreva detalhadamente o serviço a ser executado"/></Field>
    <Field label="Observações"><textarea style={{...S.input,minHeight:50,resize:'vertical'}} value={os.observacoes||''} onChange={e=>u('observacoes',e.target.value)}/></Field>
    {missing.length>0&&<div style={{background:'#422006',border:'1px solid #F59E0B',borderRadius:6,padding:'8px 12px',marginTop:10,fontSize:11,color:'#F59E0B'}}>Campos obrigatórios: {missing.join(', ')}</div>}
    <div style={{display:'flex',justifyContent:'space-between',marginTop:16,paddingTop:14,borderTop:'1px solid #1F1F23',gap:10,flexWrap:'wrap'}}>
      <div>{onDel&&<button style={S.btnD} onClick={onDel}>Excluir</button>}</div>
      <div style={{display:'flex',gap:10}}><button style={S.btnS} onClick={onCancel}>Cancelar</button><button style={{...S.btnP,opacity:canSave&&!saving?1:.4}} onClick={canSave?onSave:undefined} disabled={saving||!canSave}>{saving?'Salvando...':isEdit?'Salvar':'Criar OS'}</button></div>
    </div>
  </div>
}

function OSDetail({os,onEdit,mobile}) {
  const hist=useOSHistorico(os.id)
  return<div>
    <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
      <StatusBadge status={os.status_os}/><PrioBadge p={os.prioridade}/>
      {os.tipos_manutencao&&<span style={badge('#888')}>{os.tipos_manutencao.nome}</span>}
      {os.tipos_falha&&<span style={badge('#888')}>{os.tipos_falha.nome}</span>}
    </div>
    <h2 style={{margin:'0 0 14px',fontSize:15,color:'#E5E5E5',lineHeight:1.4}}>{os.titulo}</h2>
    <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'8px 16px',marginBottom:14}}>
      {[['Área',os.areas?.nome],['Equipamento',os.equipamentos?`${os.equipamentos.nome}${os.equipamentos.codigo?' ('+os.equipamentos.codigo+')':''}`:null],
        ['Mecânico',os.mecanicos?.nome||'Não atribuído'],['Solicitante',os.solicitante],
        ['Executado por',os.executado_por],['Recebido por',os.recebido_por],
        ['Abertura',fmtDT(os.data_abertura)],['Início',fmtDT(os.data_inicio)],
        ['Conclusão',fmtDT(os.data_conclusao)],
      ].map(([l,v])=><div key={l}><div style={{fontSize:9,color:'#666',textTransform:'uppercase',marginBottom:2}}>{l}</div><div style={{fontSize:12,color:'#CCC'}}>{v||'—'}</div></div>)}
    </div>
    {os.descricao&&<div style={{marginBottom:12}}><div style={{fontSize:9,color:'#666',textTransform:'uppercase',marginBottom:4}}>Descrição</div><div style={{fontSize:12,color:'#CCC',lineHeight:1.5,background:'#1A1A1E',padding:10,borderRadius:6,maxHeight:150,overflow:'auto'}}>{os.descricao}</div></div>}
    {hist.length>0&&<div style={{marginBottom:12}}><div style={{fontSize:9,color:'#666',textTransform:'uppercase',marginBottom:8}}>Histórico</div>
      <div style={{borderLeft:'2px solid #2A2A30',marginLeft:6,paddingLeft:12}}>{hist.map((h,i)=>
        <div key={h.id} style={{marginBottom:10,position:'relative'}}><div style={{position:'absolute',left:-18,top:3,width:6,height:6,borderRadius:'50%',background:i===0?ACCENT:'#2A2A30'}}/><div style={{fontSize:10,color:'#666'}}>{fmtDT(h.created_at)}</div><div style={{fontSize:11,color:'#CCC'}}>{h.acao}</div></div>
      )}</div></div>}
    <div style={{display:'flex',justifyContent:'flex-end',paddingTop:14,borderTop:'1px solid #1F1F23'}}><button style={S.btnP} onClick={onEdit}>✏️ Editar</button></div>
  </div>
}
