import React, { useState, useMemo, useEffect } from 'react'
import { useLookups, useOSHistorico, useViewport } from '../hooks/useData'
import { S, badge, StatusBadge, PrioBadge, Modal, Field, Empty, Search, Confirm, Loading, fmtDate, fmtDT, fmtHrs } from '../components/UI'
import { PRIORIDADES, PRIO_LABEL, ACCENT, FONT_DISPLAY } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { useUser } from '../App'

const hoje = () => new Date().toISOString().split('T')[0]
const mesAtualFrom = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
const mesAnteriorRange = () => { const d=new Date(); d.setMonth(d.getMonth()-1); const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'); return { from:`${y}-${m}-01`, to:`${y}-${m}-${new Date(y,d.getMonth()+1,0).getDate()}` } }

export default function OrdensServico({ initialStatusFilter, onClearFilter }) {
  const { areas, statusList, tiposMan, tiposFalha, mecanicos, equipamentos } = useLookups()
  const vp = useViewport()
  const { user, perfil } = useUser()

  // Period state
  const [periodoInput, setPeriodoInput] = useState({ from: mesAtualFrom(), to: hoje() })
  const [periodoAtivo, setPeriodoAtivo] = useState({ from: mesAtualFrom(), to: hoje() })
  const [presetAtivo, setPresetAtivo] = useState('mes')

  // Data
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [fStatus, setFS] = useState('TODOS')
  const [fTipo, setFT] = useState('TODOS')

  // Modal
  const [modal, setModal] = useState(null)
  const [os, setOs] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)

  // Preset buttons
  const aplicarPreset = (tipo) => {
    let from, to
    if (tipo === 'mes') { from = mesAtualFrom(); to = hoje() }
    else if (tipo === 'anterior') { const r = mesAnteriorRange(); from = r.from; to = r.to }
    else if (tipo === 'trimestre') { const d = new Date(); d.setMonth(d.getMonth()-3); from = d.toISOString().split('T')[0]; to = hoje() }
    else if (tipo === 'tudo') { from = '2020-01-01'; to = hoje() }
    setPresetAtivo(tipo)
    setPeriodoInput({ from, to })
    setPeriodoAtivo({ from, to })
  }

  // Apply initialStatusFilter
  useEffect(() => {
    if (initialStatusFilter && statusList.length > 0) {
      const st = statusList.find(s => s.nome === initialStatusFilter)
      if (st) setFS(st.id)
      aplicarPreset('tudo')
    }
  }, [initialStatusFilter, statusList])

  // Load OS
  useEffect(() => {
    (async () => {
      setLoading(true)
      const { from, to } = periodoAtivo
      let all = [], pg = 0
      while (true) {
        const { data: rows } = await supabase.from('ordens_servico')
          .select('id,numero_ordem,titulo,descricao,descricao_execucao,prioridade,data_abertura,data_inicio,data_conclusao,tempo_execucao_min,solicitante,executado_por,recebido_por,observacoes,equipamento_id,equipamentos(id,nome,codigo),areas(id,nome),status_os(id,nome,cor,cor_bg,icone),tipos_manutencao(id,nome),tipos_falha(id,nome),mecanicos(id,nome)')
          .gte('data_abertura', from+'T00:00:00').lte('data_abertura', to+'T23:59:59')
          .order('data_abertura',{ascending:false}).range(pg*500,(pg+1)*500-1)
        if (!rows||rows.length===0) break
        all = all.concat(rows)
        if (rows.length<500) break
        pg++; if(pg>40) break
      }
      setOrdens(all)
      setLoading(false)
    })()
  }, [periodoAtivo.from, periodoAtivo.to])

  const filtered = useMemo(() => ordens.filter(o => {
    if (fStatus !== 'TODOS' && o.status_os?.id !== fStatus) return false
    if (fTipo !== 'TODOS' && o.tipos_manutencao?.id !== fTipo) return false
    if (search) {
      const s = search.toLowerCase()
      return (o.numero_ordem||'').includes(s)||(o.equipamentos?.nome||'').toLowerCase().includes(s)||
        (o.descricao||'').toLowerCase().includes(s)||(o.solicitante||'').toLowerCase().includes(s)||
        (o.titulo||'').toLowerCase().includes(s)
    }
    return true
  }), [ordens, search, fStatus, fTipo])

  const refetch = () => setPeriodoAtivo({...periodoAtivo})

  const novaOS = () => {
    // Next OS number
    const maxNum = ordens.reduce((mx, o) => Math.max(mx, parseInt(o.numero_ordem)||0), 20215)
    setOs({
      numero_ordem: String(maxNum+1), equipamento_id:'', area_id:'', tipo_manutencao_id:'', tipo_falha_id:'',
      descricao:'', prioridade:'Media', solicitante: user?.nome||'', observacoes:'',
      status_id: statusList.find(s=>s.nome==='Aberta')?.id||'', mecanico_responsavel_id:'',
    })
    setModal('nova')
  }

  const salvar = async () => {
    setSaving(true)
    const d = {...os}
    ;['areas','equipamentos','mecanicos','status_os','tipos_manutencao','tipos_falha'].forEach(k=>delete d[k])
    Object.keys(d).forEach(k=>{if(d[k]==='')d[k]=null})
    const eq = equipamentos.find(e=>e.id===d.equipamento_id)
    const tipo = tiposMan.find(t=>t.id===d.tipo_manutencao_id)
    const area = areas.find(a=>a.id===d.area_id)
    d.titulo = eq ? `${eq.codigo||''} - ${eq.nome}` : `${tipo?.nome||'OS'} - ${area?.nome||''}`.trim()

    if (modal === 'nova') {
      await supabase.from('ordens_servico').insert(d)
    } else {
      const id = d.id; delete d.id; delete d.created_at; delete d.updated_at
      await supabase.from('ordens_servico').update(d).eq('id', id)
    }
    setSaving(false); setModal(null); refetch()
  }

  const isSolic = perfil === 'solicitante'
  const isMec = perfil === 'mecanico'
  const activeFilter = fStatus!=='TODOS' ? statusList.find(s=>s.id===fStatus)?.nome : null

  if (loading && ordens.length === 0) return <Loading />

  return <div>
    {/* Header */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
      <h1 style={{margin:0,fontFamily:FONT_DISPLAY,fontSize:vp.isMobile?22:30,letterSpacing:2,color:ACCENT}}>ORDENS DE SERVIÇO</h1>
      <button style={S.btnP} onClick={novaOS}>{isSolic?'📝 ABRIR OS':'+ NOVA OS'}</button>
    </div>

    {/* Period buttons */}
    <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
      {[['mes','Mês Atual'],['anterior','Mês Anterior'],['trimestre','Trimestre'],['tudo','Tudo']].map(([k,l])=>
        <button key={k} onClick={()=>aplicarPreset(k)} style={{
          ...S.btnS,padding:'6px 12px',minHeight:30,fontSize:10,fontWeight:600,
          background:presetAtivo===k?ACCENT+'22':'transparent',color:presetAtivo===k?ACCENT:'#888',borderColor:presetAtivo===k?ACCENT:'#2A2A30',
        }}>{l}</button>
      )}
      <div style={{display:'flex',gap:6,alignItems:'center',marginLeft:4}}>
        <input type="date" style={{...S.input,width:130,marginBottom:0,padding:'5px 8px',fontSize:10}} value={periodoInput.from} onChange={e=>setPeriodoInput(p=>({...p,from:e.target.value}))}/>
        <span style={{color:'#555',fontSize:10}}>até</span>
        <input type="date" style={{...S.input,width:130,marginBottom:0,padding:'5px 8px',fontSize:10}} value={periodoInput.to} onChange={e=>setPeriodoInput(p=>({...p,to:e.target.value}))}/>
        <button style={{...S.btnP,padding:'6px 12px',fontSize:10,minHeight:30}} onClick={()=>{setPresetAtivo('custom');setPeriodoAtivo({...periodoInput})}}>🔍 Pesquisar</button>
      </div>
    </div>

    {activeFilter && <div style={{background:'#1E3A5F',border:'1px solid #3B82F6',borderRadius:6,padding:'6px 12px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:11,color:'#93C5FD'}}>Filtrado: <strong>{activeFilter}</strong> ({filtered.length})</span>
      <button style={{...S.btnS,padding:'2px 8px',minHeight:24,fontSize:10}} onClick={()=>{setFS('TODOS');onClearFilter?.()}}>✕</button>
    </div>}

    {/* Filters */}
    <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
      <Search value={search} onChange={setSearch} ph="Nº OS, equipamento, solicitante..."/>
      <select style={{...S.select,width:160}} value={fStatus} onChange={e=>setFS(e.target.value)}><option value="TODOS">Todos Status</option>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select>
      <select style={{...S.select,width:160}} value={fTipo} onChange={e=>setFT(e.target.value)}><option value="TODOS">Todos Tipos</option>{tiposMan.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select>
      <span style={{fontSize:10,color:'#555'}}>{filtered.length} OS{loading?' (carregando...)':''}</span>
    </div>

    {/* Table */}
    {filtered.length===0?<Empty icon="📋" msg="Nenhuma OS no período" action="Nova OS" onAction={novaOS}/>:
      vp.isMobile?<div style={{display:'flex',flexDirection:'column',gap:8}}>{filtered.slice(0,100).map(o=>
        <div key={o.id} style={{...S.card,padding:12}} onClick={()=>{setOs({...o});setModal('ver')}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:700,color:ACCENT}}>OS #{o.numero_ordem||'—'}</span>
            <StatusBadge status={o.status_os}/>
          </div>
          {o.equipamentos?.nome&&<div style={{fontSize:13,fontWeight:600,color:'#E5E5E5',marginBottom:3}}>⚙️ {o.equipamentos.nome}</div>}
          <div style={{fontSize:11,color:'#CCC',marginBottom:4}}>{(o.descricao||'').substring(0,60)}</div>
          <div style={{display:'flex',gap:8,fontSize:10,color:'#888',flexWrap:'wrap'}}>
            {o.tipos_manutencao&&<span style={badge(o.tipos_manutencao.nome==='Corretiva'?'#EF4444':'#3B82F6')}>{o.tipos_manutencao.nome}</span>}
            <span>{o.areas?.nome||''}</span>
            <span>📝 {o.solicitante||'—'}</span>
            <span>{fmtDate(o.data_abertura)}</span>
          </div>
        </div>
      )}</div>:
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>
        <th style={S.th}>Nº</th><th style={S.th}>Equipamento</th><th style={S.th}>Descrição</th><th style={S.th}>Tipo</th><th style={S.th}>Área</th><th style={S.th}>Status</th><th style={S.th}>Solicitante</th><th style={S.th}>Data</th><th style={S.th}></th>
      </tr></thead><tbody>{filtered.slice(0,200).map(o=>
        <tr key={o.id} style={{cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='#1A1A1E'} onMouseLeave={e=>e.currentTarget.style.background='transparent'} onClick={()=>{setOs({...o});setModal('ver')}}>
          <td style={{...S.td,color:ACCENT,fontWeight:700,fontSize:12}}>#{o.numero_ordem||'—'}</td>
          <td style={{...S.td,fontWeight:600,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.equipamentos?.nome||'—'}{o.equipamentos?.codigo?<span style={{fontSize:10,color:'#666'}}> ({o.equipamentos.codigo})</span>:''}</td>
          <td style={{...S.td,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12,color:'#999'}}>{o.descricao||'—'}</td>
          <td style={S.td}>{o.tipos_manutencao?<span style={badge(o.tipos_manutencao.nome==='Corretiva'?'#EF4444':o.tipos_manutencao.nome==='Preventiva'?'#3B82F6':'#888')}>{o.tipos_manutencao.nome}</span>:'—'}</td>
          <td style={{...S.td,fontSize:11}}>{o.areas?.nome||'—'}</td>
          <td style={S.td}><StatusBadge status={o.status_os}/></td>
          <td style={{...S.td,fontSize:11,color:'#999'}}>{o.solicitante||'—'}</td>
          <td style={{...S.td,fontSize:11,color:'#888'}}>{fmtDate(o.data_abertura)}</td>
          <td style={S.td}><div style={{display:'flex',gap:3}}>
            <button style={{...S.btnS,padding:'3px 6px',minHeight:28,fontSize:10}} onClick={e=>{e.stopPropagation();setOs({...o});setModal('editar')}}>✏️</button>
            {isMec&&o.status_os?.nome!=='Concluída'&&<button style={{...S.btnS,padding:'3px 6px',minHeight:28,fontSize:10,color:'#3B82F6',borderColor:'#3B82F6'}} onClick={e=>{e.stopPropagation();setOs({...o});setModal('atender')}}>🔧</button>}
          </div></td>
        </tr>
      )}</tbody></table>
        {filtered.length>200&&<div style={{textAlign:'center',padding:8,color:'#666',fontSize:10}}>200 de {filtered.length}</div>}
      </div>
    }

    {/* Modal Nova/Editar */}
    <Modal open={modal==='nova'||modal==='editar'} onClose={()=>setModal(null)} title={modal==='nova'?'NOVA ORDEM DE SERVIÇO':'EDITAR OS #'+(os?.numero_ordem||'')} mobile={vp.isMobile}>
      {os&&<OSForm os={os} setOs={setOs} onSave={salvar} onCancel={()=>setModal(null)}
        onDel={modal==='editar'&&!isSolic?()=>setConfirm({msg:'Excluir?',ok:async()=>{await supabase.from('ordens_servico').delete().eq('id',os.id);setConfirm(null);setModal(null);refetch()}}):null}
        areas={areas} equipamentos={equipamentos} mecanicos={mecanicos} statusList={statusList}
        tiposMan={tiposMan} tiposFalha={tiposFalha} isEdit={modal==='editar'} saving={saving} mobile={vp.isMobile} perfil={perfil}/>}
    </Modal>

    {/* Modal Atender */}
    <Modal open={modal==='atender'} onClose={()=>setModal(null)} title={'🔧 ATENDER OS #'+(os?.numero_ordem||'')} mobile={vp.isMobile}>
      {os&&<AtenderOS os={os} statusList={statusList} onDone={()=>{setModal(null);refetch()}} mobile={vp.isMobile}/>}
    </Modal>

    {/* Modal Ver - SOFMAN style */}
    <Modal open={modal==='ver'} onClose={()=>setModal(null)} title={'ORDEM DE SERVIÇO Nº '+(os?.numero_ordem||'—')} mobile={vp.isMobile}>
      {os&&<OSDetailSOFMAN os={os} onEdit={()=>setModal(isMec?'atender':'editar')} mobile={vp.isMobile} perfil={perfil}/>}
    </Modal>
    <Confirm open={!!confirm} msg={confirm?.msg} onOk={confirm?.ok} onNo={()=>setConfirm(null)}/>
  </div>
}

// ── Formulário ──
function OSForm({os,setOs,onSave,onCancel,onDel,areas,equipamentos,mecanicos,statusList,tiposMan,tiposFalha,isEdit,saving,mobile,perfil}) {
  const u=(f,v)=>setOs({...os,[f]:v})
  const isSolic=perfil==='solicitante'
  const filteredEquip=useMemo(()=>{if(os.area_id){const ae=equipamentos.filter(e=>e.area_id===os.area_id);if(ae.length>0)return ae}return equipamentos},[equipamentos,os.area_id])
  const missing=[]
  if(!(os.solicitante||'').trim())missing.push('Solicitante')
  if(!os.tipo_manutencao_id)missing.push('Tipo Manutenção')
  if(!os.area_id)missing.push('Área')
  const canSave=missing.length===0

  return<div>
    <div style={{background:'#1A1A1E',borderRadius:8,padding:14,marginBottom:14,borderLeft:'3px solid '+ACCENT}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
        <span style={{fontSize:11,color:'#888'}}>OS Nº</span>
        <span style={{fontSize:18,fontWeight:900,color:ACCENT,fontFamily:"'Bebas Neue',monospace",letterSpacing:2}}>#{os.numero_ordem||'AUTO'}</span>
      </div>
      <Field label="Equipamento"><select style={{...S.select,fontSize:14,padding:'10px 12px',fontWeight:600}} value={os.equipamento_id||''} onChange={e=>u('equipamento_id',e.target.value)}>
        <option value="">Selecione o equipamento</option>{filteredEquip.map(e=><option key={e.id} value={e.id}>{e.codigo?e.codigo+' - ':''}{e.nome}</option>)}
      </select></Field>
    </div>
    <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'0 14px'}}>
      <Field label="Solicitante" req><input style={S.input} value={os.solicitante||''} onChange={e=>u('solicitante',e.target.value)} placeholder="Quem solicitou"/></Field>
      <Field label="Área / Localização" req><select style={S.select} value={os.area_id||''} onChange={e=>u('area_id',e.target.value)}><option value="">Selecione *</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>
      <Field label="Tipo de Manutenção" req><select style={S.select} value={os.tipo_manutencao_id||''} onChange={e=>u('tipo_manutencao_id',e.target.value)}><option value="">Selecione *</option>{tiposMan.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>
      {!isSolic&&<Field label="Tipo de Falha"><select style={S.select} value={os.tipo_falha_id||''} onChange={e=>u('tipo_falha_id',e.target.value)}><option value="">Selecione</option>{tiposFalha.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>}
      <Field label="Prioridade"><select style={S.select} value={os.prioridade||'Media'} onChange={e=>u('prioridade',e.target.value)}>{Object.entries(PRIO_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
      {isEdit&&!isSolic&&<Field label="Status"><select style={S.select} value={os.status_id||''} onChange={e=>u('status_id',e.target.value)}>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select></Field>}
      {!isSolic&&<Field label="Mecânico"><select style={S.select} value={os.mecanico_responsavel_id||''} onChange={e=>u('mecanico_responsavel_id',e.target.value)}><option value="">Não atribuído</option>{mecanicos.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></Field>}
    </div>
    <Field label="Descrição da Solicitação" req><textarea style={{...S.input,minHeight:80,resize:'vertical'}} value={os.descricao||''} onChange={e=>u('descricao',e.target.value)} placeholder="Descreva o problema"/></Field>
    {!isSolic&&<Field label="Observações"><textarea style={{...S.input,minHeight:50,resize:'vertical'}} value={os.observacoes||''} onChange={e=>u('observacoes',e.target.value)} placeholder="Recebido por, Liberado por, Falha..."/></Field>}
    {missing.length>0&&<div style={{background:'#422006',border:'1px solid #F59E0B',borderRadius:6,padding:'6px 10px',fontSize:11,color:'#F59E0B',marginTop:8}}>Obrigatórios: {missing.join(', ')}</div>}
    <div style={{display:'flex',justifyContent:'space-between',marginTop:16,paddingTop:14,borderTop:'1px solid #1F1F23',gap:10,flexWrap:'wrap'}}>
      <div>{onDel&&<button style={S.btnD} onClick={onDel}>Excluir</button>}</div>
      <div style={{display:'flex',gap:10}}><button style={S.btnS} onClick={onCancel}>Cancelar</button>
        <button style={{...S.btnP,opacity:canSave&&!saving?1:.4}} onClick={canSave?onSave:undefined} disabled={saving||!canSave}>{saving?'Salvando...':isEdit?'Salvar':'Abrir OS'}</button></div>
    </div>
  </div>
}

// ── Atender (mecânico) ──
function AtenderOS({os,statusList,onDone,mobile}) {
  const [descExec,setDescExec]=useState(os.descricao_execucao||'')
  const [statusId,setStatusId]=useState(os.status_id||'')
  const [saving,setSaving]=useState(false)
  const [mats,setMats]=useState([])
  const [allMats,setAllMats]=useState([])
  const [matSel,setMatSel]=useState('')
  const [matQtd,setMatQtd]=useState(1)

  useEffect(()=>{
    supabase.from('os_materiais').select('*,materiais(nome,codigo,unidade)').eq('ordem_servico_id',os.id).then(({data})=>setMats(data||[]))
    supabase.from('materiais').select('id,nome,codigo,unidade,quantidade').order('nome').then(({data})=>setAllMats(data||[]))
  },[os.id])

  const addMat=async()=>{if(!matSel||matQtd<=0)return;const mat=allMats.find(m=>m.id===matSel);if(!mat)return;const{data:row}=await supabase.from('os_materiais').insert({ordem_servico_id:os.id,material_id:mat.id,descricao:mat.nome,quantidade:matQtd}).select('*,materiais(nome,codigo,unidade)').single();if(row){setMats(p=>[...p,row]);await supabase.from('materiais').update({quantidade:Math.max(0,mat.quantidade-matQtd)}).eq('id',mat.id)}setMatSel('');setMatQtd(1)}
  const removeMat=async(m)=>{await supabase.from('os_materiais').delete().eq('id',m.id);setMats(p=>p.filter(x=>x.id!==m.id));if(m.material_id){const mat=allMats.find(x=>x.id===m.material_id);if(mat)await supabase.from('materiais').update({quantidade:mat.quantidade+(m.quantidade||0)}).eq('id',mat.id)}}

  const salvar=async()=>{setSaving(true);const upd={descricao_execucao:descExec,status_id:statusId};const stNome=statusList.find(s=>s.id===statusId)?.nome;if(stNome==='Concluída'){upd.data_conclusao=new Date().toISOString();if(!os.data_inicio)upd.data_inicio=os.data_abertura}if(stNome==='Em Andamento'&&!os.data_inicio)upd.data_inicio=new Date().toISOString();await supabase.from('ordens_servico').update(upd).eq('id',os.id);setSaving(false);onDone()}

  return<div>
    <div style={{background:'#1A1A1E',borderRadius:8,padding:12,marginBottom:14,borderLeft:'3px solid #3B82F6'}}>
      <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:13,fontWeight:700,color:ACCENT}}>{os.equipamentos?.nome||os.titulo}</span><span style={{color:'#888',fontSize:11}}>OS #{os.numero_ordem}</span></div>
      <div style={{fontSize:11,color:'#888',marginTop:4}}>{os.areas?.nome} · {(os.descricao||'').substring(0,80)}</div>
      <div style={{fontSize:10,color:'#666',marginTop:4}}>Solicitante: {os.solicitante||'—'} · {fmtDT(os.data_abertura)}</div>
    </div>
    <Field label="Status"><select style={S.select} value={statusId} onChange={e=>setStatusId(e.target.value)}>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select></Field>
    <Field label="Descrição do Serviço Realizado"><textarea style={{...S.input,minHeight:80,resize:'vertical'}} value={descExec} onChange={e=>setDescExec(e.target.value)} placeholder="O que foi feito, peças trocadas..."/></Field>
    <div style={{background:'#1A1A1E',borderRadius:8,padding:12,marginBottom:14}}>
      <div style={{fontSize:10,color:'#888',textTransform:'uppercase',fontWeight:600,marginBottom:8}}>📦 Materiais ({mats.length})</div>
      {mats.map(m=><div key={m.id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #222',fontSize:11}}>
        <span style={{color:'#CCC'}}>{m.materiais?.nome} ({m.materiais?.codigo})</span>
        <div style={{display:'flex',gap:6,alignItems:'center'}}><span style={{color:'#3B82F6',fontWeight:700}}>{m.quantidade} {m.materiais?.unidade}</span><span style={{cursor:'pointer',color:'#EF4444',fontSize:12}} onClick={()=>removeMat(m)}>✕</span></div>
      </div>)}
      <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
        <select style={{...S.select,flex:1,fontSize:11,minWidth:140}} value={matSel} onChange={e=>setMatSel(e.target.value)}><option value="">Material...</option>{allMats.map(m=><option key={m.id} value={m.id}>{m.nome} ({m.codigo}) Est:{m.quantidade}</option>)}</select>
        <input style={{...S.input,width:55,textAlign:'center',marginBottom:0}} type="number" min="1" value={matQtd} onChange={e=>setMatQtd(parseInt(e.target.value)||1)}/>
        <button style={{...S.btnP,padding:'6px 12px',fontSize:10}} onClick={addMat}>+ Add</button>
      </div>
    </div>
    <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingTop:12,borderTop:'1px solid #1F1F23'}}>
      <button style={{...S.btnP,background:'#22C55E'}} onClick={salvar} disabled={saving}>{saving?'Salvando...':'✅ Salvar Atendimento'}</button>
    </div>
  </div>
}

// ── Detalhes SOFMAN style ──
function OSDetailSOFMAN({os,onEdit,mobile,perfil}) {
  const hist=useOSHistorico(os.id)
  const [mats,setMats]=useState([])
  useEffect(()=>{supabase.from('os_materiais').select('*,materiais(nome,codigo,unidade)').eq('ordem_servico_id',os.id).then(({data})=>setMats(data||[]))},[os.id])

  const Row=({label,value,accent})=><div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #1A1A1E'}}>
    <span style={{fontSize:10,color:'#666',textTransform:'uppercase',fontWeight:600}}>{label}</span>
    <span style={{fontSize:12,color:accent||'#CCC',fontWeight:accent?700:400,textAlign:'right'}}>{value||'—'}</span>
  </div>

  return<div>
    {/* Header like SOFMAN */}
    <div style={{background:'#1A1A1E',borderRadius:8,padding:16,marginBottom:14,border:'1px solid #2A2A30'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div style={{fontSize:28,fontWeight:900,color:ACCENT,fontFamily:"'Bebas Neue',monospace",letterSpacing:3}}>Nº {os.numero_ordem||'—'}</div>
        <StatusBadge status={os.status_os}/>
      </div>
      {os.equipamentos&&<div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:'#666',textTransform:'uppercase',marginBottom:2}}>Equipamento</div>
        <div style={{fontSize:16,fontWeight:700,color:'#E5E5E5'}}>⚙️ {os.equipamentos.codigo?os.equipamentos.codigo+' - ':''}{os.equipamentos.nome}</div>
      </div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
        <div><span style={{fontSize:9,color:'#555'}}>LOCALIZAÇÃO: </span><span style={{fontSize:11,color:'#CCC'}}>{os.areas?.nome||'—'}</span></div>
        <div><span style={{fontSize:9,color:'#555'}}>TIPO: </span><span style={{fontSize:11,color:os.tipos_manutencao?.nome==='Corretiva'?'#EF4444':'#3B82F6'}}>{os.tipos_manutencao?.nome||'—'}</span></div>
      </div>
    </div>

    <Row label="Solicitante" value={os.solicitante} accent={ACCENT}/>
    <Row label="Data Programada" value={fmtDT(os.data_abertura)}/>
    {os.tipos_falha&&<Row label="Tipo de Falha" value={os.tipos_falha.nome}/>}
    <Row label="Prioridade" value={({'Critica':'🔴 Crítica','Alta':'🟠 Alta','Media':'🟡 Média','Baixa':'🟢 Baixa'})[os.prioridade]||os.prioridade}/>
    {os.recebido_por&&<Row label="Recebido por" value={os.recebido_por}/>}
    {os.executado_por&&<Row label="Liberado por" value={os.executado_por}/>}
    {os.mecanicos&&<Row label="Mecânico" value={os.mecanicos.nome}/>}

    {/* Descrição da solicitação */}
    {os.descricao&&<div style={{marginTop:12}}>
      <div style={{fontSize:10,color:'#666',textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Descrição da Solicitação</div>
      <div style={{fontSize:12,color:'#CCC',lineHeight:1.6,background:'#1A1A1E',padding:12,borderRadius:6}}>{os.descricao}</div>
    </div>}

    {os.observacoes&&<div style={{marginTop:10}}>
      <div style={{fontSize:10,color:'#666',textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Observações</div>
      <div style={{fontSize:12,color:'#CCC',lineHeight:1.6,background:'#1A1A1E',padding:12,borderRadius:6}}>{os.observacoes}</div>
    </div>}

    {/* Apontamento da execução */}
    <div style={{marginTop:14,background:'#0D2137',border:'1px solid #1E3A5F',borderRadius:8,padding:14}}>
      <div style={{fontSize:10,color:'#3B82F6',textTransform:'uppercase',fontWeight:600,marginBottom:8}}>Apontamento da Execução</div>
      <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'4px 14px'}}>
        <div><span style={{fontSize:9,color:'#555'}}>INÍCIO: </span><span style={{fontSize:11,color:'#CCC'}}>{fmtDT(os.data_inicio)||'—'}</span></div>
        <div><span style={{fontSize:9,color:'#555'}}>FIM: </span><span style={{fontSize:11,color:'#CCC'}}>{fmtDT(os.data_conclusao)||'—'}</span></div>
        {os.tempo_execucao_min>0&&<div><span style={{fontSize:9,color:'#555'}}>TEMPO: </span><span style={{fontSize:11,color:'#3B82F6',fontWeight:700}}>{os.tempo_execucao_min} min</span></div>}
      </div>
      {os.descricao_execucao&&<div style={{marginTop:8}}>
        <div style={{fontSize:9,color:'#555',marginBottom:4}}>SERVIÇO REALIZADO:</div>
        <div style={{fontSize:12,color:'#E5E5E5',lineHeight:1.5}}>{os.descricao_execucao}</div>
      </div>}
    </div>

    {/* Materiais */}
    {mats.length>0&&<div style={{marginTop:12}}>
      <div style={{fontSize:10,color:'#666',textTransform:'uppercase',fontWeight:600,marginBottom:6}}>📦 Materiais / Diversos</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>
        <th style={{...S.th,fontSize:9,padding:'4px 6px'}}>Descrição</th><th style={{...S.th,fontSize:9,padding:'4px 6px'}}>Un.</th><th style={{...S.th,fontSize:9,padding:'4px 6px'}}>Qtde</th>
      </tr></thead><tbody>{mats.map(m=><tr key={m.id}>
        <td style={{...S.td,fontSize:11,padding:'4px 6px'}}>{m.materiais?.nome||m.descricao}</td>
        <td style={{...S.td,fontSize:11,padding:'4px 6px',color:'#888'}}>{m.materiais?.unidade||'—'}</td>
        <td style={{...S.td,fontSize:11,padding:'4px 6px',color:'#3B82F6',fontWeight:700}}>{m.quantidade}</td>
      </tr>)}</tbody></table>
    </div>}

    {hist.length>0&&<div style={{marginTop:12}}>
      <div style={{fontSize:10,color:'#666',textTransform:'uppercase',fontWeight:600,marginBottom:6}}>Histórico</div>
      <div style={{borderLeft:'2px solid #2A2A30',marginLeft:6,paddingLeft:12}}>{hist.map((h,i)=>
        <div key={h.id} style={{marginBottom:6,position:'relative'}}><div style={{position:'absolute',left:-18,top:3,width:5,height:5,borderRadius:'50%',background:i===0?ACCENT:'#2A2A30'}}/><div style={{fontSize:9,color:'#555'}}>{fmtDT(h.created_at)}</div><div style={{fontSize:11,color:'#CCC'}}>{h.acao}</div></div>
      )}</div>
    </div>}

    <div style={{display:'flex',justifyContent:'flex-end',paddingTop:14,marginTop:14,borderTop:'1px solid #1F1F23',gap:8}}>
      {perfil==='solicitante'?<span style={{fontSize:11,color:'#666'}}>Acompanhe o status acima</span>:
        <button style={S.btnP} onClick={onEdit}>{perfil==='mecanico'?'🔧 Atender':'✏️ Editar'}</button>}
    </div>
  </div>
}
