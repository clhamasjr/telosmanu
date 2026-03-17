import React, { useState, useMemo, useEffect } from 'react'
import { useLookups, useOSHistorico, useViewport } from '../hooks/useData'
import { S, badge, StatusBadge, PrioBadge, Modal, Field, Empty, Search, Confirm, Loading, fmtDate, fmtDT } from '../components/UI'
import { PRIO_LABEL, ACCENT, FONT_DISPLAY } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { useUser } from '../App'
import { getPermissao } from '../lib/constants'

const hoje = () => new Date().toISOString().split('T')[0]
const mesFrom = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }

export default function OrdensServico({ initialStatusFilter, onClearFilter }) {
  const { areas, statusList, tiposMan, tiposFalha, mecanicos, equipamentos } = useLookups()
  const vp = useViewport()
  const { user, perfil } = useUser()
  const [pInput, setPInput] = useState({ from: mesFrom(), to: hoje() })
  const [pAtivo, setPAtivo] = useState({ from: mesFrom(), to: hoje() })
  const [preset, setPreset] = useState('mes')
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fStatus, setFS] = useState('TODOS')
  const [fTipo, setFT] = useState('TODOS')
  const [modal, setModal] = useState(null)
  const [os, setOs] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [descPadrao, setDescPadrao] = useState([])

  useEffect(() => { supabase.from('descricoes_padrao').select('*').eq('ativo',true).order('categoria').order('descricao').then(({data})=>setDescPadrao(data||[])) }, [])

  const aplicarPreset = (t) => {
    let f, to; const d = new Date()
    if (t==='mes') { f=mesFrom(); to=hoje() }
    else if (t==='anterior') { d.setMonth(d.getMonth()-1); const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'); f=`${y}-${m}-01`; to=`${y}-${m}-${new Date(y,d.getMonth()+1,0).getDate()}` }
    else if (t==='trimestre') { d.setMonth(d.getMonth()-3); f=d.toISOString().split('T')[0]; to=hoje() }
    else if (t==='tudo') { f='2020-01-01'; to=hoje() }
    setPreset(t); setPInput({from:f,to}); setPAtivo({from:f,to})
  }

  useEffect(() => {
    if (initialStatusFilter && statusList.length>0) { const st=statusList.find(s=>s.nome===initialStatusFilter); if(st) setFS(st.id); aplicarPreset('tudo') }
  }, [initialStatusFilter, statusList])

  useEffect(() => {
    let c=false
    ;(async()=>{
      setLoading(true); const {from,to}=pAtivo; let all=[],pg=0
      while(true){
        const{data:rows}=await supabase.from('ordens_servico')
          .select('id,numero_ordem,titulo,descricao,descricao_execucao,prioridade,data_abertura,data_inicio,data_conclusao,tempo_execucao_min,solicitante,executado_por,recebido_por,observacoes,equipamento_id,equipamentos(id,nome,codigo,area_id),areas(id,nome),status_os(id,nome,cor,cor_bg,icone),tipos_manutencao(id,nome),tipos_falha(id,nome),mecanicos(id,nome)')
          .gte('data_abertura',from+'T00:00:00').lte('data_abertura',to+'T23:59:59')
          .order('numero_ordem',{ascending:false}).range(pg*500,(pg+1)*500-1)
        if(c||!rows||rows.length===0)break; all=all.concat(rows)
        if(rows.length<500)break; pg++; if(pg>40)break
      }
      if(!c){setOrdens(all);setLoading(false)}
    })()
    return()=>{c=true}
  }, [pAtivo.from, pAtivo.to])

  const filtered = useMemo(()=>ordens.filter(o=>{
    if(fStatus!=='TODOS'&&o.status_os?.id!==fStatus)return false
    if(fTipo!=='TODOS'&&o.tipos_manutencao?.id!==fTipo)return false
    if(search){const s=search.toLowerCase();return(o.numero_ordem||'').includes(s)||(o.equipamentos?.nome||'').toLowerCase().includes(s)||(o.descricao||'').toLowerCase().includes(s)||(o.solicitante||'').toLowerCase().includes(s)}
    return true
  }),[ordens,search,fStatus,fTipo])

  const refetch = ()=>setPAtivo({...pAtivo})

  const novaOS = () => {
    setOs({
      numero_ordem:'', equipamento_id:'', area_id:'', tipo_manutencao_id:'', tipo_falha_id:'',
      descricao:'', prioridade:'Media', solicitante:user?.nome||'', observacoes:'',
      status_id:statusList.find(s=>s.nome==='Aberta')?.id||'',
    })
    setModal('nova')
  }

  // Load full OS from DB to avoid stale data on edit
  const openEdit = async (o) => {
    const {data:full} = await supabase.from('ordens_servico')
      .select('*,equipamentos(id,nome,codigo,area_id),areas(id,nome),status_os(id,nome,cor,cor_bg,icone),tipos_manutencao(id,nome),tipos_falha(id,nome),mecanicos(id,nome)')
      .eq('id',o.id).single()
    if(full) { setOs(full); setModal('editar') }
    else { setOs({...o}); setModal('editar') }
  }

  const salvar = async () => {
    setSaving(true)
    const d={...os}
    ;['areas','equipamentos','mecanicos','status_os','tipos_manutencao','tipos_falha'].forEach(k=>delete d[k])
    Object.keys(d).forEach(k=>{if(d[k]==='')d[k]=null})
    const eq=equipamentos.find(e=>e.id===d.equipamento_id)
    const tipo=tiposMan.find(t=>t.id===d.tipo_manutencao_id)
    const area=areas.find(a=>a.id===d.area_id)
    d.titulo=eq?`${eq.codigo||''} - ${eq.nome}`:`${tipo?.nome||'OS'} - ${area?.nome||''}`
    if(modal==='nova'){
      await supabase.from('ordens_servico').insert(d)
    } else {
      const id=d.id; delete d.id; delete d.created_at; delete d.updated_at
      await supabase.from('ordens_servico').update(d).eq('id',id)
    }
    setSaving(false); setModal(null); refetch()
  }

  const canEdit = getPermissao(perfil,'os_editar')
  const canCreate = getPermissao(perfil,'os_criar')
  const canAtender = getPermissao(perfil,'os_atender')
  const canAprovar = getPermissao(perfil,'os_aprovar')
  const isGestorPlus = perfil==='admin'||perfil==='gestor'||perfil==='supervisor'
  const isSolic = perfil==='solicitante'
  const activeFilter = fStatus!=='TODOS'?statusList.find(s=>s.id===fStatus)?.nome:null

  if(loading&&ordens.length===0)return<Loading/>

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
      <h1 style={{margin:0,fontFamily:FONT_DISPLAY,fontSize:vp.isMobile?22:30,letterSpacing:2,color:ACCENT}}>ORDENS DE SERVIÇO</h1>
      {canCreate&&<button style={S.btnP} onClick={novaOS}>{isSolic?'📝 ABRIR OS':'+ NOVA OS'}</button>}
    </div>
    <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
      {[['mes','Mês Atual'],['anterior','Mês Anterior'],['trimestre','Trimestre'],['tudo','Tudo']].map(([k,l])=>
        <button key={k} onClick={()=>aplicarPreset(k)} style={{...S.btnS,padding:'6px 12px',minHeight:30,fontSize:10,fontWeight:600,background:preset===k?ACCENT+'22':'transparent',color:preset===k?ACCENT:'#888',borderColor:preset===k?ACCENT:'#2A2A30'}}>{l}</button>
      )}
      <div style={{display:'flex',gap:4,alignItems:'center'}}>
        <input type="date" style={{...S.input,width:125,marginBottom:0,padding:'5px 6px',fontSize:10}} value={pInput.from} onChange={e=>setPInput(p=>({...p,from:e.target.value}))}/>
        <span style={{color:'#444',fontSize:9}}>a</span>
        <input type="date" style={{...S.input,width:125,marginBottom:0,padding:'5px 6px',fontSize:10}} value={pInput.to} onChange={e=>setPInput(p=>({...p,to:e.target.value}))}/>
        <button style={{...S.btnP,padding:'6px 10px',fontSize:10,minHeight:28}} onClick={()=>{setPreset('custom');setPAtivo({...pInput})}}>🔍</button>
      </div>
    </div>
    {activeFilter&&<div style={{background:'#1E3A5F',border:'1px solid #3B82F6',borderRadius:6,padding:'6px 12px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:11,color:'#93C5FD'}}>Filtro: <strong>{activeFilter}</strong> ({filtered.length})</span>
      <button style={{...S.btnS,padding:'2px 8px',minHeight:24,fontSize:10}} onClick={()=>{setFS('TODOS');onClearFilter?.()}}>✕</button>
    </div>}
    <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
      <Search value={search} onChange={setSearch} ph="Nº, equipamento, solicitante..."/>
      <select style={{...S.select,width:150,fontSize:11}} value={fStatus} onChange={e=>setFS(e.target.value)}><option value="TODOS">Todos Status</option>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select>
      <select style={{...S.select,width:140,fontSize:11}} value={fTipo} onChange={e=>setFT(e.target.value)}><option value="TODOS">Todos Tipos</option>{tiposMan.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select>
      <span style={{fontSize:10,color:'#555'}}>{filtered.length} OS</span>
    </div>

    {filtered.length===0?<Empty icon="📋" msg="Nenhuma OS no período" action="Nova OS" onAction={canCreate?novaOS:undefined}/>:
      vp.isMobile?<div style={{display:'flex',flexDirection:'column',gap:8}}>{filtered.slice(0,100).map(o=>
        <div key={o.id} style={{...S.card,padding:12}} onClick={()=>{setOs({...o});setModal('ver')}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:700,color:ACCENT}}>OS #{o.numero_ordem||'—'}</span><StatusBadge status={o.status_os}/>
          </div>
          {o.equipamentos?.nome&&<div style={{fontSize:13,fontWeight:600,color:'#E5E5E5',marginBottom:3}}>⚙️ {o.equipamentos.nome}</div>}
          <div style={{fontSize:11,color:'#CCC',marginBottom:3}}>{(o.descricao||'').substring(0,60)}</div>
          <div style={{display:'flex',gap:6,fontSize:10,color:'#888',flexWrap:'wrap'}}>
            {o.tipos_manutencao&&<span style={badge(o.tipos_manutencao.nome==='Corretiva'?'#EF4444':'#3B82F6')}>{o.tipos_manutencao.nome}</span>}
            <span>{o.areas?.nome}</span><span>📝 {o.solicitante||'—'}</span><span>{fmtDate(o.data_abertura)}</span>
          </div>
        </div>
      )}</div>:
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>
        <th style={S.th}>Nº</th><th style={S.th}>Equipamento</th><th style={S.th}>Descrição</th><th style={S.th}>Tipo</th><th style={S.th}>Área</th><th style={S.th}>Status</th><th style={S.th}>Solicitante</th><th style={S.th}>Data</th><th style={S.th}></th>
      </tr></thead><tbody>{filtered.slice(0,200).map(o=>
        <tr key={o.id} style={{cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='#1A1A1E'} onMouseLeave={e=>e.currentTarget.style.background='transparent'} onClick={()=>{setOs({...o});setModal('ver')}}>
          <td style={{...S.td,color:ACCENT,fontWeight:700,fontSize:12}}>#{o.numero_ordem||'—'}</td>
          <td style={{...S.td,fontWeight:600,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.equipamentos?.nome||'—'}</td>
          <td style={{...S.td,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11,color:'#999'}}>{o.descricao||'—'}</td>
          <td style={S.td}>{o.tipos_manutencao?<span style={badge(o.tipos_manutencao.nome==='Corretiva'?'#EF4444':'#3B82F6')}>{o.tipos_manutencao.nome}</span>:'—'}</td>
          <td style={{...S.td,fontSize:11}}>{o.areas?.nome||'—'}</td>
          <td style={S.td}><StatusBadge status={o.status_os}/></td>
          <td style={{...S.td,fontSize:11,color:'#999'}}>{o.solicitante||'—'}</td>
          <td style={{...S.td,fontSize:10,color:'#888'}}>{fmtDate(o.data_abertura)}</td>
          <td style={S.td}><div style={{display:'flex',gap:3}}>
            {canEdit&&<button style={{...S.btnS,padding:'3px 6px',minHeight:26,fontSize:9}} onClick={e=>{e.stopPropagation();openEdit(o)}}>✏️</button>}
            {canAtender&&o.status_os?.nome!=='Concluída'&&o.status_os?.nome!=='Aguardando Aprovação'&&<button style={{...S.btnS,padding:'3px 6px',minHeight:26,fontSize:9,color:'#3B82F6',borderColor:'#3B82F6'}} onClick={e=>{e.stopPropagation();setOs({...o});setModal('atender')}}>🔧</button>}
            {canAprovar&&o.status_os?.nome==='Aguardando Aprovação'&&<button style={{...S.btnS,padding:'3px 6px',minHeight:26,fontSize:9,color:'#22C55E',borderColor:'#22C55E'}} onClick={e=>{e.stopPropagation();setOs({...o});setModal('aprovar')}}>✅</button>}
          </div></td>
        </tr>
      )}</tbody></table></div>}

    {/* Modal Nova/Editar */}
    <Modal open={modal==='nova'||modal==='editar'} onClose={()=>setModal(null)} title={modal==='nova'?'NOVA ORDEM DE SERVIÇO':'EDITAR OS #'+(os?.numero_ordem||'')} mobile={vp.isMobile}>
      {os&&<OSForm os={os} setOs={setOs} onSave={salvar} onCancel={()=>setModal(null)}
        onDel={canEdit&&modal==='editar'?()=>setConfirm({msg:'Excluir?',ok:async()=>{await supabase.from('ordens_servico').delete().eq('id',os.id);setConfirm(null);setModal(null);refetch()}}):null}
        areas={areas} equipamentos={equipamentos} mecanicos={mecanicos} statusList={statusList}
        tiposMan={tiposMan} tiposFalha={tiposFalha} descPadrao={descPadrao} isEdit={modal==='editar'}
        saving={saving} mobile={vp.isMobile} perfil={perfil} isGestorPlus={isGestorPlus}/>}
    </Modal>
    <Modal open={modal==='atender'} onClose={()=>setModal(null)} title={'🔧 ATENDER OS #'+(os?.numero_ordem||'')} mobile={vp.isMobile}>
      {os&&<AtenderOS os={os} statusList={statusList} mecanicos={mecanicos} onDone={()=>{setModal(null);refetch()}} mobile={vp.isMobile}/>}
    </Modal>
    <Modal open={modal==='aprovar'} onClose={()=>setModal(null)} title={'✅ APROVAR OS #'+(os?.numero_ordem||'')} mobile={vp.isMobile}>
      {os&&<AprovarOS os={os} statusList={statusList} onDone={()=>{setModal(null);refetch()}}/>}
    </Modal>
    <Modal open={modal==='ver'} onClose={()=>setModal(null)} title={'OS Nº '+(os?.numero_ordem||'—')} mobile={vp.isMobile}>
      {os&&<OSDetail os={os} onEdit={()=>canEdit?openEdit(os):null} onAtender={()=>setModal('atender')} onAprovar={()=>setModal('aprovar')} mobile={vp.isMobile} perfil={perfil} mecanicos={mecanicos}/>}
    </Modal>
    <Confirm open={!!confirm} msg={confirm?.msg} onOk={confirm?.ok} onNo={()=>setConfirm(null)}/>
  </div>
}

// ── Formulário ──
function OSForm({os,setOs,onSave,onCancel,onDel,areas,equipamentos,mecanicos,statusList,tiposMan,tiposFalha,descPadrao,isEdit,saving,mobile,perfil,isGestorPlus}) {
  const u=(f,v)=>setOs({...os,[f]:v})
  const isSolic=perfil==='solicitante'
  // When equipment changes, auto-fill area
  const onEquipChange = (eqId) => {
    const eq = equipamentos.find(e=>e.id===eqId)
    const updates = {equipamento_id:eqId}
    if(eq?.area_id) updates.area_id = eq.area_id
    setOs({...os,...updates})
  }
  const filteredEquip=useMemo(()=>{if(os.area_id){const ae=equipamentos.filter(e=>e.area_id===os.area_id);if(ae.length>0)return ae}return equipamentos},[equipamentos,os.area_id])
  const missing=[]; if(!(os.solicitante||'').trim())missing.push('Solicitante'); if(!os.tipo_manutencao_id)missing.push('Tipo'); if(!os.area_id)missing.push('Área')
  const canSave=missing.length===0
  // After opening, lock fields unless gestor+
  const isLocked = isEdit && !isGestorPlus
  const descByCat=useMemo(()=>{const m={};descPadrao.forEach(d=>{const c=d.categoria||'Geral';if(!m[c])m[c]=[];m[c].push(d)});return m},[descPadrao])

  return<div>
    <div style={{background:'#1A1A1E',borderRadius:8,padding:14,marginBottom:14,borderLeft:'3px solid '+ACCENT}}>
      <div style={{display:'flex',gap:14,marginBottom:10,alignItems:'center'}}>
        <div>
          <div style={{fontSize:9,color:'#666',textTransform:'uppercase'}}>Nº da OS</div>
          <input style={{...S.input,width:100,fontSize:18,fontWeight:900,color:ACCENT,fontFamily:"'Bebas Neue',monospace",letterSpacing:2,textAlign:'center',marginBottom:0}}
            value={os.numero_ordem||''} onChange={e=>u('numero_ordem',e.target.value)} placeholder="AUTO"/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:'#666',textTransform:'uppercase'}}>Equipamento {isLocked&&'🔒'}</div>
          <select style={{...S.select,fontSize:14,padding:'10px 12px',fontWeight:600,opacity:isLocked?.6:1}} value={os.equipamento_id||''} onChange={e=>onEquipChange(e.target.value)} disabled={isLocked}>
            <option value="">Selecione o equipamento</option>{(isLocked?equipamentos:filteredEquip).map(e=><option key={e.id} value={e.id}>{e.codigo?e.codigo+' - ':''}{e.nome}</option>)}
          </select>
        </div>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'0 14px'}}>
      <Field label="Solicitante" req><input style={{...S.input,background:'#1A1A1E',fontWeight:600}} value={os.solicitante||''} readOnly={isSolic} onChange={e=>u('solicitante',e.target.value)}/></Field>
      <Field label={'Área / Localização'+(isLocked?' 🔒':'')} req><select style={{...S.select,opacity:isLocked?.6:1}} value={os.area_id||''} onChange={e=>u('area_id',e.target.value)} disabled={isLocked}><option value="">Selecione *</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>
      <Field label={'Tipo de Manutenção'+(isLocked?' 🔒':'')} req><select style={{...S.select,opacity:isLocked?.6:1}} value={os.tipo_manutencao_id||''} onChange={e=>u('tipo_manutencao_id',e.target.value)} disabled={isLocked}><option value="">Selecione *</option>{tiposMan.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>
      {!isSolic&&<Field label={'Tipo de Falha'+(isLocked?' 🔒':'')}><select style={{...S.select,opacity:isLocked?.6:1}} value={os.tipo_falha_id||''} onChange={e=>u('tipo_falha_id',e.target.value)} disabled={isLocked}><option value="">Selecione</option>{tiposFalha.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>}
      <Field label="Prioridade"><select style={S.select} value={os.prioridade||'Media'} onChange={e=>u('prioridade',e.target.value)}>{Object.entries(PRIO_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
      {isEdit&&<Field label="Status"><select style={S.select} value={os.status_id||''} onChange={e=>u('status_id',e.target.value)}>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select></Field>}
    </div>
    <Field label="Descrição do Problema / Serviço" req>
      {descPadrao.length>0&&<select style={{...S.select,marginBottom:6,fontSize:11,color:'#888'}} value="" onChange={e=>{if(e.target.value)u('descricao',(os.descricao?os.descricao+'. ':'')+e.target.value)}}>
        <option value="">📋 Selecionar descrição padrão...</option>
        {Object.entries(descByCat).map(([cat,items])=><optgroup key={cat} label={cat}>{items.map(d=><option key={d.id} value={d.descricao}>{d.descricao}</option>)}</optgroup>)}
      </select>}
      <textarea style={{...S.input,minHeight:80,resize:'vertical'}} value={os.descricao||''} onChange={e=>u('descricao',e.target.value)} placeholder="Descreva o problema"/>
    </Field>
    {!isSolic&&<Field label="Observações"><textarea style={{...S.input,minHeight:50,resize:'vertical'}} value={os.observacoes||''} onChange={e=>u('observacoes',e.target.value)}/></Field>}

    {/* Materials section in edit mode */}
    {isEdit&&os.id&&<OSMateriais osId={os.id}/>}

    {missing.length>0&&<div style={{background:'#422006',border:'1px solid #F59E0B',borderRadius:6,padding:'6px 10px',fontSize:11,color:'#F59E0B',marginTop:8}}>Obrigatórios: {missing.join(', ')}</div>}
    <div style={{display:'flex',justifyContent:'space-between',marginTop:16,paddingTop:14,borderTop:'1px solid #1F1F23',gap:10,flexWrap:'wrap'}}>
      <div>{onDel&&<button style={S.btnD} onClick={onDel}>Excluir</button>}</div>
      <div style={{display:'flex',gap:10}}><button style={S.btnS} onClick={onCancel}>Cancelar</button>
        <button style={{...S.btnP,opacity:canSave&&!saving?1:.4}} onClick={canSave?onSave:undefined} disabled={saving||!canSave}>{saving?'Salvando...':isEdit?'Salvar':'Abrir OS'}</button></div>
    </div>
  </div>
}

// ── Materiais na OS (reusável) ──
function OSMateriais({osId}) {
  const [mats,setMats]=useState([])
  const [allMats,setAllMats]=useState([])
  const [matSel,setMatSel]=useState('')
  const [matQtd,setMatQtd]=useState(1)
  useEffect(()=>{
    supabase.from('os_materiais').select('*,materiais(nome,codigo,unidade)').eq('ordem_servico_id',osId).then(({data})=>setMats(data||[]))
    supabase.from('materiais').select('id,nome,codigo,unidade,quantidade').order('nome').then(({data})=>setAllMats(data||[]))
  },[osId])
  const addMat=async()=>{if(!matSel||matQtd<=0)return;const mat=allMats.find(m=>m.id===matSel);if(!mat)return;const{data:row}=await supabase.from('os_materiais').insert({ordem_servico_id:osId,material_id:mat.id,descricao:mat.nome,quantidade:matQtd}).select('*,materiais(nome,codigo,unidade)').single();if(row){setMats(p=>[...p,row]);await supabase.from('materiais').update({quantidade:Math.max(0,mat.quantidade-matQtd)}).eq('id',mat.id)}setMatSel('');setMatQtd(1)}
  const removeMat=async(m)=>{await supabase.from('os_materiais').delete().eq('id',m.id);setMats(p=>p.filter(x=>x.id!==m.id))}
  return<div style={{background:'#1A1A1E',borderRadius:8,padding:12,marginTop:14}}>
    <div style={{fontSize:10,color:'#888',textTransform:'uppercase',fontWeight:600,marginBottom:8}}>📦 Materiais Utilizados ({mats.length})</div>
    {mats.map(m=><div key={m.id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #222',fontSize:11}}>
      <span style={{color:'#CCC'}}>{m.materiais?.nome} ({m.materiais?.codigo})</span>
      <div style={{display:'flex',gap:6,alignItems:'center'}}><span style={{color:'#3B82F6',fontWeight:700}}>{m.quantidade} {m.materiais?.unidade}</span><span style={{cursor:'pointer',color:'#EF4444'}} onClick={()=>removeMat(m)}>✕</span></div>
    </div>)}
    <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
      <select style={{...S.select,flex:1,fontSize:11,minWidth:140}} value={matSel} onChange={e=>setMatSel(e.target.value)}><option value="">Material...</option>{allMats.map(m=><option key={m.id} value={m.id}>{m.nome} ({m.codigo}) Est:{m.quantidade}</option>)}</select>
      <input style={{...S.input,width:55,textAlign:'center',marginBottom:0}} type="number" min="1" value={matQtd} onChange={e=>setMatQtd(parseInt(e.target.value)||1)}/>
      <button style={{...S.btnP,padding:'6px 12px',fontSize:10}} onClick={addMat}>+ Add</button>
    </div>
  </div>
}

// ── Mecânicos múltiplos na OS ──
function OSMecanicos({osId, mecanicos}) {
  const [linked,setLinked]=useState([])
  const [mecSel,setMecSel]=useState('')
  useEffect(()=>{
    supabase.from('os_mecanicos').select('*,mecanicos(id,nome)').eq('ordem_servico_id',osId).then(({data})=>setLinked(data||[]))
  },[osId])
  const add=async()=>{if(!mecSel)return;const{data:row}=await supabase.from('os_mecanicos').insert({ordem_servico_id:osId,mecanico_id:mecSel,data_inicio:new Date().toISOString()}).select('*,mecanicos(id,nome)').single();if(row)setLinked(p=>[...p,row]);setMecSel('')}
  const rem=async(m)=>{await supabase.from('os_mecanicos').delete().eq('id',m.id);setLinked(p=>p.filter(x=>x.id!==m.id))}
  return<div style={{marginBottom:14}}>
    <div style={{fontSize:10,color:'#888',textTransform:'uppercase',fontWeight:600,marginBottom:6}}>👨‍🔧 Mecânicos ({linked.length})</div>
    {linked.map(m=><div key={m.id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #222',fontSize:12}}>
      <span style={{color:'#E5E5E5',fontWeight:600}}>🔧 {m.mecanicos?.nome}</span>
      <span style={{cursor:'pointer',color:'#EF4444',fontSize:11}} onClick={()=>rem(m)}>✕</span>
    </div>)}
    <div style={{display:'flex',gap:6,marginTop:6}}>
      <select style={{...S.select,flex:1,fontSize:11}} value={mecSel} onChange={e=>setMecSel(e.target.value)}><option value="">Adicionar mecânico...</option>{mecanicos.filter(m=>!linked.some(l=>l.mecanico_id===m.id)).map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select>
      <button style={{...S.btnP,padding:'6px 12px',fontSize:10}} onClick={add}>+</button>
    </div>
  </div>
}

// ── Atender → Aguardando Aprovação ──
function AtenderOS({os,statusList,mecanicos,onDone,mobile}) {
  const [descExec,setDescExec]=useState(os.descricao_execucao||'')
  const [saving,setSaving]=useState(false)
  const isAberta=os.status_os?.nome==='Aberta'
  const iniciar=async()=>{const st=statusList.find(s=>s.nome==='Em Andamento');await supabase.from('ordens_servico').update({status_id:st?.id,data_inicio:new Date().toISOString()}).eq('id',os.id);onDone()}
  const finalizar=async()=>{
    setSaving(true)
    const st=statusList.find(s=>s.nome==='Aguardando Aprovação')
    await supabase.from('ordens_servico').update({descricao_execucao:descExec,status_id:st?.id,data_conclusao:new Date().toISOString(),...(!os.data_inicio?{data_inicio:os.data_abertura}:{})}).eq('id',os.id)
    setSaving(false);onDone()
  }
  return<div>
    <div style={{background:'#1A1A1E',borderRadius:8,padding:12,marginBottom:14,borderLeft:'3px solid #3B82F6'}}>
      <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:14,fontWeight:700,color:ACCENT}}>{os.equipamentos?.nome||os.titulo}</span><span style={{color:'#888',fontSize:11}}>OS #{os.numero_ordem}</span></div>
      <div style={{fontSize:11,color:'#888',marginTop:4}}>{os.areas?.nome} · {(os.descricao||'').substring(0,80)}</div>
      <div style={{fontSize:10,color:'#666',marginTop:4}}>Solicitante: {os.solicitante||'—'} · {fmtDT(os.data_abertura)}</div>
    </div>
    {isAberta?<div style={{textAlign:'center',marginBottom:14}}>
      <button style={{...S.btnP,background:'#3B82F6',padding:'12px 24px',fontSize:14}} onClick={iniciar}>🔧 INICIAR ATENDIMENTO</button>
      <div style={{fontSize:10,color:'#666',marginTop:6}}>Registra data/hora de início</div>
    </div>:<>
      <OSMecanicos osId={os.id} mecanicos={mecanicos}/>
      <Field label="Descrição do Serviço Realizado"><textarea style={{...S.input,minHeight:80,resize:'vertical'}} value={descExec} onChange={e=>setDescExec(e.target.value)} placeholder="O que foi feito..."/></Field>
      <OSMateriais osId={os.id}/>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingTop:12,marginTop:10,borderTop:'1px solid #1F1F23'}}>
        <button style={{...S.btnP,background:'#22C55E'}} onClick={finalizar} disabled={saving}>{saving?'Salvando...':'✅ Finalizar (Enviar p/ Aprovação)'}</button>
      </div>
    </>}
  </div>
}

// ── Aprovar ──
function AprovarOS({os,statusList,onDone}) {
  const [saving,setSaving]=useState(false)
  const aprovar=async()=>{setSaving(true);await supabase.from('ordens_servico').update({status_id:statusList.find(s=>s.nome==='Concluída')?.id}).eq('id',os.id);setSaving(false);onDone()}
  const rejeitar=async()=>{setSaving(true);await supabase.from('ordens_servico').update({status_id:statusList.find(s=>s.nome==='Em Andamento')?.id,data_conclusao:null}).eq('id',os.id);setSaving(false);onDone()}
  return<div>
    <div style={{background:'#1A1A1E',borderRadius:8,padding:14,marginBottom:16}}>
      <div style={{fontSize:14,fontWeight:700,color:ACCENT}}>{os.equipamentos?.nome||os.titulo}</div>
      <div style={{fontSize:12,color:'#888',marginTop:6}}>Solicitante: {os.solicitante}</div>
      {os.descricao&&<div style={{fontSize:12,color:'#CCC',marginTop:8,lineHeight:1.5}}><strong>Problema:</strong> {os.descricao}</div>}
      {os.descricao_execucao&&<div style={{fontSize:12,color:'#93C5FD',marginTop:8,lineHeight:1.5,background:'#0D2137',padding:10,borderRadius:6}}><strong>Serviço:</strong> {os.descricao_execucao}</div>}
    </div>
    <div style={{display:'flex',gap:12}}>
      <button style={{...S.btnP,flex:1,background:'#22C55E',padding:14,fontSize:14}} onClick={aprovar} disabled={saving}>✅ APROVAR</button>
      <button style={{...S.btnP,flex:1,background:'#EF4444',padding:14,fontSize:14}} onClick={rejeitar} disabled={saving}>↩️ DEVOLVER</button>
    </div>
  </div>
}

// ── Detalhe SOFMAN ──
function OSDetail({os,onEdit,onAtender,onAprovar,mobile,perfil,mecanicos:allMec}) {
  const hist=useOSHistorico(os.id)
  const [mats,setMats]=useState([])
  const [osMecs,setOsMecs]=useState([])
  useEffect(()=>{
    supabase.from('os_materiais').select('*,materiais(nome,codigo,unidade)').eq('ordem_servico_id',os.id).then(({data})=>setMats(data||[]))
    supabase.from('os_mecanicos').select('*,mecanicos(nome)').eq('ordem_servico_id',os.id).then(({data})=>setOsMecs(data||[]))
  },[os.id])
  const isAprov=os.status_os?.nome==='Aguardando Aprovação'
  const canApr=isAprov&&(perfil==='admin'||perfil==='gestor'||perfil==='supervisor'||perfil==='solicitante')
  const canAtend=getPermissao(perfil,'os_atender')&&os.status_os?.nome!=='Concluída'&&os.status_os?.nome!=='Aguardando Aprovação'
  const R=({l,v,a})=><div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #1A1A1E'}}>
    <span style={{fontSize:10,color:'#666',textTransform:'uppercase',fontWeight:600}}>{l}</span><span style={{fontSize:12,color:a||'#CCC',fontWeight:a?700:400}}>{v||'—'}</span></div>
  return<div>
    <div style={{background:'#1A1A1E',borderRadius:8,padding:16,marginBottom:14,border:'1px solid #2A2A30'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div style={{fontSize:28,fontWeight:900,color:ACCENT,fontFamily:"'Bebas Neue',monospace",letterSpacing:3}}>Nº {os.numero_ordem||'—'}</div><StatusBadge status={os.status_os}/>
      </div>
      {os.equipamentos&&<div style={{marginBottom:6}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase'}}>Equipamento</div>
        <div style={{fontSize:16,fontWeight:700,color:'#E5E5E5'}}>⚙️ {os.equipamentos.codigo?os.equipamentos.codigo+' - ':''}{os.equipamentos.nome}</div></div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11}}>
        <div><span style={{color:'#555'}}>LOCALIZAÇÃO: </span><span style={{color:'#CCC'}}>{os.areas?.nome||'—'}</span></div>
        <div><span style={{color:'#555'}}>TIPO: </span><span style={{color:os.tipos_manutencao?.nome==='Corretiva'?'#EF4444':'#3B82F6'}}>{os.tipos_manutencao?.nome||'—'}</span></div>
      </div>
    </div>
    <R l="Solicitante" v={os.solicitante} a={ACCENT}/><R l="Data Abertura" v={fmtDT(os.data_abertura)}/>
    {os.tipos_falha&&<R l="Falha" v={os.tipos_falha.nome}/>}
    <R l="Prioridade" v={({Critica:'🔴 Crítica',Alta:'🟠 Alta',Media:'🟡 Média',Baixa:'🟢 Baixa'})[os.prioridade]}/>
    {osMecs.length>0&&<div style={{padding:'5px 0',borderBottom:'1px solid #1A1A1E'}}>
      <span style={{fontSize:10,color:'#666',textTransform:'uppercase',fontWeight:600}}>Mecânicos</span>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>{osMecs.map(m=><span key={m.id} style={{...badge('#3B82F6'),fontSize:11}}>🔧 {m.mecanicos?.nome}</span>)}</div>
    </div>}
    {os.descricao&&<div style={{marginTop:10}}><div style={{fontSize:10,color:'#666',textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Descrição da Solicitação</div>
      <div style={{fontSize:12,color:'#CCC',lineHeight:1.6,background:'#1A1A1E',padding:12,borderRadius:6}}>{os.descricao}</div></div>}
    <div style={{marginTop:12,background:'#0D2137',border:'1px solid #1E3A5F',borderRadius:8,padding:14}}>
      <div style={{fontSize:10,color:'#3B82F6',textTransform:'uppercase',fontWeight:600,marginBottom:8}}>Apontamento da Execução</div>
      <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'4px 14px',fontSize:11}}>
        <div><span style={{color:'#555'}}>INÍCIO: </span><span style={{color:'#CCC'}}>{fmtDT(os.data_inicio)||'—'}</span></div>
        <div><span style={{color:'#555'}}>FIM: </span><span style={{color:'#CCC'}}>{fmtDT(os.data_conclusao)||'—'}</span></div>
      </div>
      {os.descricao_execucao&&<div style={{marginTop:8}}><div style={{fontSize:9,color:'#555',marginBottom:3}}>SERVIÇO REALIZADO:</div><div style={{fontSize:12,color:'#E5E5E5',lineHeight:1.5}}>{os.descricao_execucao}</div></div>}
    </div>
    {mats.length>0&&<div style={{marginTop:12}}><div style={{fontSize:10,color:'#666',textTransform:'uppercase',fontWeight:600,marginBottom:6}}>📦 Materiais / Diversos</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{...S.th,fontSize:9,padding:'4px 6px'}}>Descrição</th><th style={{...S.th,fontSize:9,padding:'4px 6px'}}>Un.</th><th style={{...S.th,fontSize:9,padding:'4px 6px'}}>Qtde</th></tr></thead>
      <tbody>{mats.map(m=><tr key={m.id}><td style={{...S.td,fontSize:11,padding:'4px 6px'}}>{m.materiais?.nome||m.descricao}</td><td style={{...S.td,fontSize:11,padding:'4px 6px',color:'#888'}}>{m.materiais?.unidade}</td><td style={{...S.td,fontSize:11,padding:'4px 6px',color:'#3B82F6',fontWeight:700}}>{m.quantidade}</td></tr>)}</tbody></table></div>}
    {canApr&&<div style={{marginTop:14,background:'#422006',border:'1px solid #F59E0B',borderRadius:8,padding:14,textAlign:'center'}}>
      <div style={{fontSize:13,fontWeight:700,color:'#F59E0B',marginBottom:8}}>⏳ Aguardando aprovação</div>
      <div style={{display:'flex',gap:10,justifyContent:'center'}}>
        <button style={{...S.btnP,background:'#22C55E',padding:'10px 20px'}} onClick={onAprovar}>✅ Aprovar</button>
        <button style={{...S.btnP,background:'#EF4444',padding:'10px 20px'}} onClick={onAprovar}>↩️ Devolver</button>
      </div>
    </div>}
    <div style={{display:'flex',justifyContent:'flex-end',paddingTop:14,marginTop:12,borderTop:'1px solid #1F1F23',gap:8}}>
      {canAtend&&<button style={{...S.btnP,background:'#3B82F6'}} onClick={onAtender}>🔧 Atender</button>}
      {getPermissao(perfil,'os_editar')&&<button style={S.btnP} onClick={onEdit}>✏️ Editar</button>}
    </div>
  </div>
}
