import React, { useState, useMemo, useEffect } from 'react'
import { useLookups, useOSHistorico, useViewport } from '../hooks/useData'
import { S, badge, StatusBadge, PrioBadge, Modal, Field, Empty, Search, Confirm, Loading, fmtDate, fmtDT } from '../components/UI'
import { PRIO_LABEL, ACCENT, FONT_DISPLAY } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { useUser } from '../App'
import { getPermissao } from '../lib/constants'

const hoje = () => new Date().toISOString().split('T')[0]
const mesFrom = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
const agoraLocal = () => { const d = new Date(); const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00` }

export default function OrdensServico({ initialStatusFilter, onClearFilter, qrEquipCode, onQrConsumed }) {
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

  // QR code scaneado: abre nova OS pré-preenchida com o equipamento
  useEffect(() => {
    if (!qrEquipCode || equipamentos.length === 0 || !statusList.length) return
    // tentar achar por código ou por id
    const eq = equipamentos.find(e => e.codigo === qrEquipCode || e.id === qrEquipCode)
    if (eq) {
      setOs({
        numero_ordem:'', equipamento_id: eq.id, area_id: eq.area_id || '', tipo_manutencao_id:'', tipo_falha_id:'',
        descricao:'', descricao_execucao:'', prioridade:'Media', solicitante: user?.nome || '', observacoes:'',
        recebido_por:'', data_recebimento:'', executado_por:'', resp_manutencao:'', liberado_por:'',
        tem_pendencia:false, pendencia_melhoria:false, pendencia_terceiros:false, pendencia_aguard_material:false,
        status_id: statusList.find(s=>s.nome==='Aberta')?.id || '',
        data_abertura: agoraLocal(),
      })
      setModal('nova')
    } else {
      alert(`Equipamento não encontrado: ${qrEquipCode}`)
    }
    onQrConsumed?.()
  }, [qrEquipCode, equipamentos, statusList])

  useEffect(() => {
    let c=false
    ;(async()=>{
      setLoading(true); const {from,to}=pAtivo; let all=[],pg=0
      while(true){
        const{data:rows}=await supabase.from('ordens_servico')
          .select('id,numero_ordem,titulo,descricao,descricao_execucao,prioridade,data_abertura,data_inicio,data_conclusao,data_recebimento,tempo_execucao_min,solicitante,executado_por,recebido_por,resp_manutencao,liberado_por,observacoes,tem_pendencia,pendencia_melhoria,pendencia_terceiros,pendencia_aguard_material,equipamento_id,equipamentos(id,nome,codigo,area_id),areas(id,nome),status_os(id,nome,cor,cor_bg,icone),tipos_manutencao(id,nome),tipos_falha(id,nome),mecanicos(id,nome)')
          .gte('data_abertura',from+'T00:00:00').lte('data_abertura',to+'T23:59:59')
          .order('data_abertura',{ascending:false}).range(pg*500,(pg+1)*500-1)
        if(c||!rows||rows.length===0)break; all=all.concat(rows)
        if(rows.length<500)break; pg++; if(pg>40)break
      }
      if(!c){setOrdens(all);setLoading(false)}
    })()
    return()=>{c=true}
  }, [pAtivo.from, pAtivo.to])

  const filtered = useMemo(()=>{
    try {
      return ordens.filter(o=>{
        if(fStatus!=='TODOS'&&o.status_os?.id!==fStatus)return false
        if(fTipo!=='TODOS'&&o.tipos_manutencao?.id!==fTipo)return false
        if(search){
          const s=search.toLowerCase()
          const num=String(o.numero_ordem||'')
          const eq=String(o.equipamentos?.nome||'')
          const desc=String(o.descricao||'')
          const sol=String(o.solicitante||'')
          const tit=String(o.titulo||'')
          return num.includes(s)||eq.toLowerCase().includes(s)||desc.toLowerCase().includes(s)||sol.toLowerCase().includes(s)||tit.toLowerCase().includes(s)
        }
        return true
      })
    } catch(e) { console.error('Filter error:', e); return ordens }
  },[ordens,search,fStatus,fTipo])

  const refetch = ()=>setPAtivo({...pAtivo})

  // Sugestões de nomes pro campo "Liberado por" (produção não tem cadastro — usa histórico)
  const sugestoesPessoas = useMemo(()=>{
    const s = new Set()
    ordens.forEach(o=>{
      const l=(o.liberado_por||'').trim(); if(l)s.add(l)
      const so=(o.solicitante||'').trim(); if(so)s.add(so)
    })
    return [...s].sort((a,b)=>a.localeCompare(b))
  },[ordens])

  const novaOS = () => {
    setOs({
      numero_ordem:'', equipamento_id:'', area_id:'', tipo_manutencao_id:'', tipo_falha_id:'',
      descricao:'', descricao_execucao:'', prioridade:'Media', solicitante:user?.nome||'', observacoes:'',
      recebido_por:'', data_recebimento:'', executado_por:'', resp_manutencao:'', liberado_por:'',
      tem_pendencia:false, pendencia_melhoria:false, pendencia_terceiros:false, pendencia_aguard_material:false,
      status_id:statusList.find(s=>s.nome==='Aberta')?.id||'',
      data_abertura: agoraLocal(),
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
    // Converter numero_ordem para integer
    if (d.numero_ordem !== null && d.numero_ordem !== undefined) {
      const n = parseInt(d.numero_ordem)
      d.numero_ordem = isNaN(n) ? null : n
    }
    const eq=equipamentos.find(e=>e.id===d.equipamento_id)
    const tipo=tiposMan.find(t=>t.id===d.tipo_manutencao_id)
    const area=areas.find(a=>a.id===d.area_id)
    d.titulo=eq?`${eq.codigo||''} - ${eq.nome}`:`${tipo?.nome||'OS'} - ${area?.nome||''}`

    // Auto-gerar numero_ordem se não preenchido (apenas em nova OS)
    if (modal==='nova' && !d.numero_ordem) {
      try {
        const { data: prox } = await supabase.rpc('proximo_numero_os')
        if (prox) d.numero_ordem = prox
      } catch (e) { /* deixa sem número se falhar */ }
    }

    let novaOSCriada = null
    if(modal==='nova'){
      const {data:created, error} = await supabase.from('ordens_servico').insert(d).select('*,equipamentos(id,nome,codigo,area_id),areas(id,nome),status_os(id,nome,cor,cor_bg,icone),tipos_manutencao(id,nome),tipos_falha(id,nome)').single()
      if (error) {
        setSaving(false)
        if (error.code === '23505' || (error.message||'').includes('duplicate') || (error.message||'').includes('unique')) {
          alert(`❌ Já existe uma OS com o número ${d.numero_ordem}. Use outro número ou deixe em branco para gerar automaticamente.`)
        } else {
          alert(`Erro ao salvar: ${error.message}`)
        }
        return
      }
      novaOSCriada = created
    } else {
      const id=d.id; delete d.id; delete d.created_at; delete d.updated_at
      const { error } = await supabase.from('ordens_servico').update(d).eq('id',id)
      if (error) {
        setSaving(false)
        if (error.code === '23505' || (error.message||'').includes('duplicate') || (error.message||'').includes('unique')) {
          alert(`❌ Já existe uma OS com o número ${d.numero_ordem}. Use outro número.`)
        } else {
          alert(`Erro ao salvar: ${error.message}`)
        }
        return
      }
    }
    setSaving(false); setModal(null); refetch()
    if (novaOSCriada && window.confirm(`OS ${novaOSCriada.numero_ordem || ''} criada com sucesso!\n\nDeseja imprimir agora?`)) {
      setOs(novaOSCriada); setModal('ver')
      setTimeout(() => { document.querySelector('[data-print-os]')?.click() }, 400)
    }
  }

  const canEdit = getPermissao(perfil,'os_editar')
  const canCreate = getPermissao(perfil,'os_criar')
  const canAtender = getPermissao(perfil,'os_atender')
  const canAprovar = getPermissao(perfil,'os_aprovar')
  const isGestorPlus = perfil==='admin'||perfil==='gestor'||perfil==='supervisor'
  const isSolic = perfil==='solicitante'
  const activeFilter = fStatus!=='TODOS'?statusList.find(s=>s.id===fStatus)?.nome:null

  const exportarCSV = () => {
    const esc = (v) => { const s = String(v ?? '').replace(/"/g, '""'); return `"${s}"` }
    const dt = (s) => s ? new Date(s).toLocaleString('pt-BR') : ''
    const prioLabel = { Critica:'Crítica', Alta:'Alta', Media:'Média', Baixa:'Baixa' }
    const headers = ['Nº OS','Equipamento','Cód. Equip','Tipo Manutenção','Tipo Falha','Área','Status','Prioridade','Solicitante','Recebido por','Data Recebimento','Data Abertura','Executado por','Resp. Manutenção','Liberado por','Início Serviço','Término Serviço','Descrição','Observações']
    const rows = filtered.map(o => [
      o.numero_ordem||'', o.equipamentos?.nome||'', o.equipamentos?.codigo||'',
      o.tipos_manutencao?.nome||'', o.tipos_falha?.nome||'', o.areas?.nome||'',
      o.status_os?.nome||'', prioLabel[o.prioridade]||o.prioridade||'',
      o.solicitante||'', o.recebido_por||'', dt(o.data_recebimento),
      dt(o.data_abertura), o.executado_por||'', o.resp_manutencao||'', o.liberado_por||'',
      dt(o.data_inicio), dt(o.data_conclusao), o.descricao||'', o.observacoes||'',
    ].map(esc).join(';'))
    const csv = '﻿' + headers.map(esc).join(';') + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `OS_${pAtivo.from||'tudo'}_a_${pAtivo.to||'hoje'}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const exportarPDF = () => {
    const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))
    const dt = (s) => s ? new Date(s).toLocaleDateString('pt-BR') : '—'
    const prioLabel = { Critica:'Crítica', Alta:'Alta', Media:'Média', Baixa:'Baixa' }
    const rows = filtered.map(o => `<tr>
      <td style="font-weight:700;color:#1E40AF">${esc(o.numero_ordem||'—')}</td>
      <td>${esc(o.equipamentos?.codigo ? o.equipamentos.codigo+' - '+o.equipamentos.nome : o.equipamentos?.nome||'—')}</td>
      <td>${esc(o.tipos_manutencao?.nome||'—')}</td>
      <td>${esc(o.areas?.nome||'—')}</td>
      <td><span style="padding:1px 5px;border-radius:8px;background:${o.status_os?.cor_bg||'#F1F5F9'};color:${o.status_os?.cor||'#334155'}">${esc((o.status_os?.icone||'')+' '+(o.status_os?.nome||'—'))}</span></td>
      <td>${esc(prioLabel[o.prioridade]||o.prioridade||'—')}</td>
      <td>${esc(o.solicitante||'—')}</td>
      <td>${esc(dt(o.data_recebimento||o.data_abertura))}</td>
      <td style="color:#555">${esc((o.descricao||'').substring(0,70))}${(o.descricao||'').length>70?'…':''}</td>
    </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ordens de Serviço</title>
<style>
@page{size:A4 landscape;margin:8mm}
body{font-family:Arial,sans-serif;font-size:9px;color:#000;margin:0;padding:4px}
h1{color:#1E40AF;font-size:14px;margin:0 0 2px;letter-spacing:2px}
.meta{color:#64748B;font-size:7px;margin-bottom:8px}
table{width:100%;border-collapse:collapse}
th{background:#1E40AF;color:#fff;padding:5px 3px;text-align:left;font-size:7px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
td{padding:3px 3px;border-bottom:1px solid #E2E8F0;vertical-align:top;font-size:8px}
tr:nth-child(even) td{background:#F8FAFC}
@media print{th{background:#1E40AF!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<h1>ORDENS DE SERVIÇO — MANUTELOS</h1>
<div class="meta">Fábrica de Algodão Telos &nbsp;·&nbsp; ${filtered.length} OS &nbsp;·&nbsp; Período: ${pAtivo.from||'início'} até ${pAtivo.to||'hoje'} &nbsp;·&nbsp; Emitido em ${new Date().toLocaleString('pt-BR')}</div>
<table><thead><tr><th>Nº</th><th>Equipamento</th><th>Tipo</th><th>Área</th><th>Status</th><th>Prioridade</th><th>Solicitante</th><th>Data</th><th>Descrição</th></tr></thead>
<tbody>${rows}</tbody></table>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`
    const w = window.open('', '_blank'); w.document.write(html); w.document.close()
  }

  if(loading&&ordens.length===0)return<Loading/>

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
      <h1 style={{margin:0,fontWeight:800,fontSize:vp.isMobile?22:30,letterSpacing:2,color:ACCENT}}>ORDENS DE SERVIÇO</h1>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {filtered.length>0&&<>
          <button style={{...S.btnS,color:'#22C55E',borderColor:'#22C55E'}} onClick={exportarCSV}>📊 Excel</button>
          <button style={{...S.btnS,color:'#A855F7',borderColor:'#A855F7'}} onClick={exportarPDF}>🖨️ PDF</button>
        </>}
        {canCreate&&<button style={S.btnP} onClick={novaOS}>{isSolic?'📝 ABRIR OS':'+ NOVA OS'}</button>}
      </div>
    </div>
    <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
      {[['mes','Mês Atual'],['anterior','Mês Anterior'],['trimestre','Trimestre'],['tudo','Tudo']].map(([k,l])=>
        <button key={k} onClick={()=>aplicarPreset(k)} style={{...S.btnS,padding:'6px 12px',minHeight:30,fontSize:10,fontWeight:600,background:preset===k?ACCENT+'22':'transparent',color:preset===k?ACCENT:'#64748B',borderColor:preset===k?ACCENT:'#CBD5E1'}}>{l}</button>
      )}
      <div style={{display:'flex',gap:4,alignItems:'center'}}>
        <input type="date" style={{...S.input,width:125,marginBottom:0,padding:'5px 6px',fontSize:10}} value={pInput.from} onChange={e=>setPInput(p=>({...p,from:e.target.value}))}/>
        <span style={{color:'#CBD5E1',fontSize:9}}>a</span>
        <input type="date" style={{...S.input,width:125,marginBottom:0,padding:'5px 6px',fontSize:10}} value={pInput.to} onChange={e=>setPInput(p=>({...p,to:e.target.value}))}/>
        <button style={{...S.btnP,padding:'6px 10px',fontSize:10,minHeight:28}} onClick={()=>{setPreset('custom');setPAtivo({...pInput})}}>🔍</button>
      </div>
    </div>
    {activeFilter&&<div style={{background:'#DBEAFE',border:'1px solid #3B82F6',borderRadius:6,padding:'6px 12px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:11,color:'#2563EB'}}>Filtro: <strong>{activeFilter}</strong> ({filtered.length})</span>
      <button style={{...S.btnS,padding:'2px 8px',minHeight:24,fontSize:10}} onClick={()=>{setFS('TODOS');onClearFilter?.()}}>✕</button>
    </div>}
    <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
      <Search value={search} onChange={setSearch} ph="Nº, equipamento, solicitante..."/>
      <select style={{...S.select,width:150,fontSize:11}} value={fStatus} onChange={e=>setFS(e.target.value)}><option value="TODOS">Todos Status</option>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select>
      <select style={{...S.select,width:140,fontSize:11}} value={fTipo} onChange={e=>setFT(e.target.value)}><option value="TODOS">Todos Tipos</option>{tiposMan.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select>
      <span style={{fontSize:10,color:'#94A3B8'}}>{filtered.length} OS</span>
    </div>

    {filtered.length===0?<Empty icon="📋" msg="Nenhuma OS no período" action="Nova OS" onAction={canCreate?novaOS:undefined}/>:
      vp.isMobile?<div style={{display:'flex',flexDirection:'column',gap:8}}>{filtered.slice(0,100).map(o=>
        <div key={o.id} style={{...S.card,padding:12}} onClick={()=>{setOs({...o});setModal('ver')}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:700,color:ACCENT}}>OS #{o.numero_ordem||'—'}</span><StatusBadge status={o.status_os}/>
          </div>
          {o.equipamentos?.nome&&<div style={{fontSize:13,fontWeight:600,color:'#0F172A',marginBottom:3}}>⚙️ {o.equipamentos.nome}</div>}
          <div style={{fontSize:11,color:'#334155',marginBottom:3}}>{(o.descricao||'').substring(0,60)}</div>
          <div style={{display:'flex',gap:6,fontSize:10,color:'#64748B',flexWrap:'wrap'}}>
            {o.tipos_manutencao&&<span style={badge(o.tipos_manutencao.nome==='Corretiva'?'#EF4444':'#3B82F6')}>{o.tipos_manutencao.nome}</span>}
            <span>{o.areas?.nome}</span><span>📝 {o.solicitante||'—'}</span><span>{fmtDate(o.data_recebimento||o.data_abertura)}</span>
          </div>
        </div>
      )}</div>:
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>
        <th style={S.th}>Nº</th><th style={S.th}>Equipamento</th><th style={S.th}>Descrição</th><th style={S.th}>Tipo</th><th style={S.th}>Área</th><th style={S.th}>Status</th><th style={S.th}>Solicitante</th><th style={S.th}>Data Receb.</th><th style={S.th}></th>
      </tr></thead><tbody>{filtered.slice(0,200).map(o=>
        <tr key={o.id} style={{cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='#F1F5F9'} onMouseLeave={e=>e.currentTarget.style.background='transparent'} onClick={()=>{setOs({...o});setModal('ver')}}>
          <td style={{...S.td,color:ACCENT,fontWeight:700,fontSize:12}}>#{o.numero_ordem||'—'}</td>
          <td style={{...S.td,fontWeight:600,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.equipamentos?.nome||'—'}</td>
          <td style={{...S.td,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11,color:'#999'}}>{o.descricao||'—'}</td>
          <td style={S.td}>{o.tipos_manutencao?<span style={badge(o.tipos_manutencao.nome==='Corretiva'?'#EF4444':'#3B82F6')}>{o.tipos_manutencao.nome}</span>:'—'}</td>
          <td style={{...S.td,fontSize:11}}>{o.areas?.nome||'—'}</td>
          <td style={S.td}><StatusBadge status={o.status_os}/></td>
          <td style={{...S.td,fontSize:11,color:'#999'}}>{o.solicitante||'—'}</td>
          <td style={{...S.td,fontSize:10,color:'#64748B'}}>{fmtDate(o.data_recebimento||o.data_abertura)}</td>
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
        saving={saving} mobile={vp.isMobile} perfil={perfil} isGestorPlus={isGestorPlus} sugestoesPessoas={sugestoesPessoas}/>}
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
function OSForm({os,setOs,onSave,onCancel,onDel,areas,equipamentos,mecanicos,statusList,tiposMan,tiposFalha,descPadrao,isEdit,saving,mobile,perfil,isGestorPlus,sugestoesPessoas=[]}) {
  const u=(f,v)=>setOs({...os,[f]:v})

  // Select de técnico que preserva valor antigo digitado à mão (não some ao editar OS legada)
  const selectTecnico=(campo)=>{
    const valor=(os[campo]||'').trim()
    const naLista=!valor||mecanicos.some(m=>m.nome===valor)
    return<select style={S.select} value={valor} onChange={e=>u(campo,e.target.value)}>
      <option value="">Selecione...</option>
      {!naLista&&<option value={valor}>{valor} (digitado)</option>}
      {mecanicos.map(m=><option key={m.id} value={m.nome}>{m.nome}</option>)}
    </select>
  }

  // Executado por: chips multi-técnico, grava como "NOME1 / NOME2" (relatório já entende)
  const execNomes=(os.executado_por||'').split(' / ').map(s=>s.trim()).filter(Boolean)
  const addExec=(nome)=>{if(!nome||execNomes.includes(nome))return;u('executado_por',[...execNomes,nome].join(' / '))}
  const remExec=(nome)=>u('executado_por',execNomes.filter(n=>n!==nome).join(' / '))
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
    <div style={{background:'#F1F5F9',borderRadius:8,padding:14,marginBottom:14,borderLeft:'3px solid '+ACCENT}}>
      <div style={{display:'flex',gap:14,marginBottom:10,alignItems:'center'}}>
        <div>
          <div style={{fontSize:9,color:'#94A3B8',textTransform:'uppercase'}}>Nº da OS</div>
          <input style={{...S.input,width:110,fontSize:18,fontWeight:800,color:ACCENT,letterSpacing:2,textAlign:'center',marginBottom:0}}
            value={os.numero_ordem||''} onChange={e=>u('numero_ordem',e.target.value.replace(/\D/g,''))} placeholder="AUTO" title="Deixe em branco para gerar automaticamente"/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:'#94A3B8',textTransform:'uppercase'}}>Equipamento {isLocked&&'🔒'}</div>
          <select style={{...S.select,fontSize:14,padding:'10px 12px',fontWeight:600,opacity:isLocked?.6:1}} value={os.equipamento_id||''} onChange={e=>onEquipChange(e.target.value)} disabled={isLocked}>
            <option value="">Selecione o equipamento</option>{(isLocked?equipamentos:filteredEquip).map(e=><option key={e.id} value={e.id}>{e.codigo?e.codigo+' - ':''}{e.nome}</option>)}
          </select>
        </div>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'0 14px'}}>
      <Field label="📅 Data de Abertura" req><input type="datetime-local" style={S.input} value={os.data_abertura?os.data_abertura.substring(0,16):''} onChange={e=>u('data_abertura',e.target.value?e.target.value+':00':null)}/></Field>
      <Field label="Solicitante" req><input style={{...S.input,background:'#F1F5F9',fontWeight:600}} value={os.solicitante||''} readOnly={isSolic} onChange={e=>u('solicitante',e.target.value)}/></Field>
      <Field label={'Área / Localização'+(isLocked?' 🔒':'')} req><select style={{...S.select,opacity:isLocked?.6:1}} value={os.area_id||''} onChange={e=>u('area_id',e.target.value)} disabled={isLocked}><option value="">Selecione *</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>
      <Field label={'Tipo de Manutenção'+(isLocked?' 🔒':'')} req><select style={{...S.select,opacity:isLocked?.6:1}} value={os.tipo_manutencao_id||''} onChange={e=>u('tipo_manutencao_id',e.target.value)} disabled={isLocked}><option value="">Selecione *</option>{tiposMan.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>
      {!isSolic&&<Field label={'Tipo de Falha'+(isLocked?' 🔒':'')}><select style={{...S.select,opacity:isLocked?.6:1}} value={os.tipo_falha_id||''} onChange={e=>u('tipo_falha_id',e.target.value)} disabled={isLocked}><option value="">Selecione</option>{tiposFalha.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>}
      <Field label="Prioridade"><select style={S.select} value={os.prioridade||'Media'} onChange={e=>u('prioridade',e.target.value)}>{Object.entries(PRIO_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
      {isEdit&&<Field label="Status"><select style={S.select} value={os.status_id||''} onChange={e=>u('status_id',e.target.value)}>{statusList.map(s=><option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select></Field>}
    </div>
    {/* Recebimento */}
    {!isSolic&&<div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'0 14px'}}>
      <Field label="Recebido por">{selectTecnico('recebido_por')}</Field>
      <Field label="Data/Hora Recebimento"><input type="datetime-local" style={S.input} value={os.data_recebimento?os.data_recebimento.substring(0,16):''} onChange={e=>u('data_recebimento',e.target.value?e.target.value+':00':null)}/></Field>
    </div>}

    <Field label="Descrição do Problema" req>
      {descPadrao.length>0&&<select style={{...S.select,marginBottom:6,fontSize:11,color:'#64748B'}} value="" onChange={e=>{if(e.target.value)u('descricao',(os.descricao?os.descricao+'. ':'')+e.target.value)}}>
        <option value="">📋 Selecionar descrição padrão...</option>
        {Object.entries(descByCat).map(([cat,items])=><optgroup key={cat} label={cat}>{items.map(d=><option key={d.id} value={d.descricao}>{d.descricao}</option>)}</optgroup>)}
      </select>}
      <textarea style={{...S.input,minHeight:70,resize:'vertical'}} value={os.descricao||''} onChange={e=>u('descricao',e.target.value)} placeholder="Descreva o problema"/>
    </Field>

    {!isSolic&&<>
      <Field label="Descrição do Serviço Executado">
        <textarea style={{...S.input,minHeight:70,resize:'vertical'}} value={os.descricao_execucao||''} onChange={e=>u('descricao_execucao',e.target.value)} placeholder="Descreva o que foi executado"/>
      </Field>

      {/* Pendências */}
      <div style={{background:'#FFFBEB',borderRadius:8,padding:12,marginTop:8,marginBottom:14,border:'1px solid #FCD34D'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:os.tem_pendencia?10:0,flexWrap:'wrap'}}>
          <span style={{fontSize:11,fontWeight:700,color:'#92400E',textTransform:'uppercase'}}>Medidas a realizar / Pendências?</span>
          <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:12}}><input type="radio" checked={os.tem_pendencia===true} onChange={()=>u('tem_pendencia',true)}/>SIM</label>
          <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:12}}><input type="radio" checked={!os.tem_pendencia} onChange={()=>setOs({...os,tem_pendencia:false,pendencia_melhoria:false,pendencia_terceiros:false,pendencia_aguard_material:false})}/>NÃO</label>
        </div>
        {os.tem_pendencia&&<div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
          <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:12,color:'#334155'}}><input type="checkbox" checked={!!os.pendencia_melhoria} onChange={e=>u('pendencia_melhoria',e.target.checked)}/>ME - Melhoria</label>
          <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:12,color:'#334155'}}><input type="checkbox" checked={!!os.pendencia_terceiros} onChange={e=>u('pendencia_terceiros',e.target.checked)}/>Por Conta de Terceiros</label>
          <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:12,color:'#334155'}}><input type="checkbox" checked={!!os.pendencia_aguard_material} onChange={e=>u('pendencia_aguard_material',e.target.checked)}/>Aguardando Material</label>
        </div>}
      </div>

      <Field label="Observações"><textarea style={{...S.input,minHeight:50,resize:'vertical'}} value={os.observacoes||''} onChange={e=>u('observacoes',e.target.value)}/></Field>

      {/* Responsáveis */}
      <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr 1fr',gap:'0 14px',marginTop:6}}>
        <Field label="Executado por">
          {execNomes.length>0&&<div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
            {execNomes.map(n=><span key={n} style={{display:'inline-flex',alignItems:'center',gap:4,background:'#EFF6FF',color:ACCENT,fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:12,border:'1px solid #BFDBFE'}}>
              {n}<button style={{background:'none',border:'none',cursor:'pointer',color:'#EF4444',fontSize:11,padding:0,lineHeight:1}} onClick={()=>remExec(n)}>✕</button>
            </span>)}
          </div>}
          <select style={S.select} value="" onChange={e=>addExec(e.target.value)}>
            <option value="">{execNomes.length>0?'+ Adicionar técnico...':'Selecione o técnico...'}</option>
            {mecanicos.filter(m=>!execNomes.includes(m.nome)).map(m=><option key={m.id} value={m.nome}>{m.nome}</option>)}
          </select>
        </Field>
        <Field label="Resp. Manutenção">{selectTecnico('resp_manutencao')}</Field>
        <Field label="Liberado por">
          <input style={S.input} list="dl-liberado-por" value={os.liberado_por||''} onChange={e=>u('liberado_por',e.target.value)} placeholder="Nome de quem liberou"/>
          <datalist id="dl-liberado-por">{sugestoesPessoas.map(n=><option key={n} value={n}/>)}</datalist>
        </Field>
      </div>

      {/* Datas serviço */}
      <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'0 14px'}}>
        <Field label="Início do Serviço"><input type="datetime-local" style={S.input} value={os.data_inicio?os.data_inicio.substring(0,16):''} onChange={e=>u('data_inicio',e.target.value?e.target.value+':00':null)}/></Field>
        <Field label="Término do Serviço"><input type="datetime-local" style={S.input} value={os.data_conclusao?os.data_conclusao.substring(0,16):''} onChange={e=>u('data_conclusao',e.target.value?e.target.value+':00':null)}/></Field>
      </div>
    </>}

    {/* Materials section in edit mode */}
    {isEdit&&os.id&&<OSMecanicos osId={os.id} mecanicos={mecanicos}/>}
    {isEdit&&os.id&&<OSMateriais osId={os.id}/>}

    {missing.length>0&&<div style={{background:'#FFFBEB',border:'1px solid #F59E0B',borderRadius:6,padding:'6px 10px',fontSize:11,color:'#F59E0B',marginTop:8}}>Obrigatórios: {missing.join(', ')}</div>}
    <div style={{display:'flex',justifyContent:'space-between',marginTop:16,paddingTop:14,borderTop:'1px solid #E2E8F0',gap:10,flexWrap:'wrap'}}>
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
  return<div style={{background:'#F1F5F9',borderRadius:8,padding:12,marginTop:14}}>
    <div style={{fontSize:10,color:'#64748B',textTransform:'uppercase',fontWeight:600,marginBottom:8}}>📦 Materiais Utilizados ({mats.length})</div>
    {mats.map(m=><div key={m.id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #222',fontSize:11}}>
      <span style={{color:'#334155'}}>{m.materiais?.nome} ({m.materiais?.codigo})</span>
      <div style={{display:'flex',gap:6,alignItems:'center'}}><span style={{color:'#3B82F6',fontWeight:700}}>{m.quantidade} {m.materiais?.unidade}</span><span style={{cursor:'pointer',color:'#EF4444'}} onClick={()=>removeMat(m)}>✕</span></div>
    </div>)}
    <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
      <select style={{...S.select,flex:1,fontSize:11,minWidth:140}} value={matSel} onChange={e=>setMatSel(e.target.value)}><option value="">Material...</option>{allMats.map(m=><option key={m.id} value={m.id}>{m.nome} ({m.codigo}) Est:{m.quantidade}</option>)}</select>
      <input style={{...S.input,width:55,textAlign:'center',marginBottom:0}} type="number" min="1" value={matQtd} onChange={e=>setMatQtd(parseInt(e.target.value)||1)}/>
      <button style={{...S.btnP,padding:'6px 12px',fontSize:10}} onClick={addMat}>+ Add</button>
    </div>
  </div>
}

// ── Mecânicos múltiplos na OS (com horário e tempo por mecânico) ──
function OSMecanicos({osId, mecanicos}) {
  const [linked, setLinked] = useState([])
  const [mecSel, setMecSel] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const reload = () => supabase.from('os_mecanicos').select('*,mecanicos(id,nome)').eq('ordem_servico_id', osId).order('data_inicio', { ascending: true }).then(({ data }) => setLinked(data || []))
  useEffect(() => { reload() }, [osId])

  const add = async () => {
    if (!mecSel) return
    const agora = new Date().toISOString()
    const { data: row } = await supabase.from('os_mecanicos').insert({
      ordem_servico_id: osId, mecanico_id: mecSel, data_inicio: agora, data_fim: null,
    }).select('*,mecanicos(id,nome)').single()
    if (row) setLinked(p => [...p, row])
    setMecSel(''); setShowAdd(false)
  }

  const finalizar = async (m) => {
    const agora = new Date()
    const inicio = m.data_inicio ? new Date(m.data_inicio) : agora
    const tempoMin = Math.max(0, Math.round((agora - inicio) / 60000))
    const { data: row } = await supabase.from('os_mecanicos')
      .update({ data_fim: agora.toISOString(), tempo_minutos: tempoMin })
      .eq('id', m.id).select('*,mecanicos(id,nome)').single()
    if (row) setLinked(p => p.map(x => x.id === m.id ? row : x))
  }

  const editar = async (m, campo, valor) => {
    const upd = { [campo]: valor || null }
    // Recalcula tempo_minutos sempre que inicio ou fim mudar
    const inicio = campo === 'data_inicio' ? (valor || null) : m.data_inicio
    const fim = campo === 'data_fim' ? (valor || null) : m.data_fim
    if (inicio && fim) {
      upd.tempo_minutos = Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / 60000))
    }
    const { data: row } = await supabase.from('os_mecanicos').update(upd).eq('id', m.id).select('*,mecanicos(id,nome)').single()
    if (row) setLinked(p => p.map(x => x.id === m.id ? row : x))
  }

  const rem = async (m) => {
    if (!window.confirm(`Remover ${m.mecanicos?.nome} desta OS?`)) return
    await supabase.from('os_mecanicos').delete().eq('id', m.id)
    setLinked(p => p.filter(x => x.id !== m.id))
  }

  const fmtDtLocal = (s) => s ? s.substring(0, 16) : ''
  const fmtMin = (m) => {
    if (!m || m < 0) return '—'
    const h = Math.floor(m / 60), min = m % 60
    return h > 0 ? `${h}h${min ? ' ' + min + 'min' : ''}` : `${min}min`
  }
  const totalMin = linked.reduce((s, m) => s + (m.tempo_minutos || 0), 0)
  // mesmo técnico pode ter vários atendimentos na OS — só bloqueia quem está ATENDENDO agora
  const disponiveis = mecanicos.filter(m => !linked.some(l => l.mecanico_id === m.id && !l.data_fim))

  return <div style={{ marginBottom: 14, background: '#F8FAFC', borderRadius: 8, padding: 12, border: '1px solid #E2E8F0' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
      <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>
        👨‍🔧 Técnicos ({linked.length}) {totalMin > 0 && <span style={{ color: ACCENT, marginLeft: 6 }}>· Total: {fmtMin(totalMin)}</span>}
      </div>
      {!showAdd && disponiveis.length > 0 && <button style={{ ...S.btnP, padding: '4px 12px', fontSize: 11, minHeight: 28 }} onClick={() => setShowAdd(true)}>+ Adicionar Técnico</button>}
    </div>

    {linked.length === 0 && <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: 10 }}>Nenhum técnico atribuído</div>}

    {linked.map((m, i) => {
      const ativo = !m.data_fim
      return <div key={m.id} style={{ background: '#FFF', borderRadius: 6, padding: 10, marginBottom: 8, border: `1px solid ${ativo ? '#22C55E' : '#E2E8F0'}`, borderLeft: `3px solid ${ativo ? '#22C55E' : ACCENT}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
            🔧 {m.mecanicos?.nome || '?'}
            {ativo && <span style={{ marginLeft: 8, fontSize: 9, background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>ATENDENDO</span>}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {m.tempo_minutos > 0 && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700, background: '#EFF6FF', padding: '2px 8px', borderRadius: 4 }}>⏱ {fmtMin(m.tempo_minutos)}</span>}
            {ativo && <button style={{ ...S.btnS, padding: '3px 10px', fontSize: 10, minHeight: 24, color: '#22C55E', borderColor: '#22C55E' }} onClick={() => finalizar(m)}>✓ Finalizar</button>}
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 14, padding: 2 }} onClick={() => rem(m)}>✕</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 2, fontWeight: 600 }}>INÍCIO</div>
            <input type="datetime-local" style={{ ...S.input, fontSize: 11, padding: '6px 8px', marginBottom: 0 }} value={fmtDtLocal(m.data_inicio)} onChange={e => editar(m, 'data_inicio', e.target.value ? e.target.value + ':00' : null)} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 2, fontWeight: 600 }}>TÉRMINO</div>
            <input type="datetime-local" style={{ ...S.input, fontSize: 11, padding: '6px 8px', marginBottom: 0 }} value={fmtDtLocal(m.data_fim)} onChange={e => editar(m, 'data_fim', e.target.value ? e.target.value + ':00' : null)} />
          </div>
        </div>
        {m.observacoes !== null && m.observacoes !== undefined && <input style={{ ...S.input, fontSize: 11, padding: '6px 8px', marginBottom: 0, marginTop: 6 }} placeholder="Observações..." value={m.observacoes || ''} onChange={e => editar(m, 'observacoes', e.target.value)} />}
      </div>
    })}

    {showAdd && <div style={{ display: 'flex', gap: 6, marginTop: 8, padding: 8, background: '#FEF3C7', borderRadius: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select style={{ ...S.select, flex: 1, fontSize: 11, minWidth: 160 }} value={mecSel} onChange={e => setMecSel(e.target.value)}>
        <option value="">Selecione o técnico...</option>
        {disponiveis.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
      <button style={{ ...S.btnP, padding: '6px 14px', fontSize: 11, minHeight: 32 }} onClick={add} disabled={!mecSel}>▶ Iniciar Atendimento</button>
      <button style={{ ...S.btnS, padding: '6px 10px', fontSize: 11, minHeight: 32 }} onClick={() => { setShowAdd(false); setMecSel('') }}>Cancelar</button>
    </div>}
  </div>
}

// ── Atender → Aguardando Aprovação ──
function AtenderOS({os,statusList,mecanicos,onDone,mobile}) {
  const [descExec,setDescExec]=useState(os.descricao_execucao||'')
  const [saving,setSaving]=useState(false)
  const isAberta=os.status_os?.nome==='Aberta'
  const isPreventiva = os.tipos_manutencao?.nome === 'Preventiva'
  // Extrair itens do procedimento (linhas numeradas como "1. ..." ou "- ..." ou simplesmente quebra de linha)
  const procedimentoItens = useMemo(() => {
    const fonte = os.descricao || ''
    if (!isPreventiva) return []
    const linhas = fonte.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 3)
    return linhas
  }, [os.descricao, isPreventiva])
  const [check, setCheck] = useState({})
  const toggleCheck = (i) => setCheck(c => ({ ...c, [i]: !c[i] }))
  const aplicarChecklist = () => {
    if (procedimentoItens.length === 0) return
    const feitos = procedimentoItens.filter((_, i) => check[i])
    if (feitos.length === 0) { alert('Marque pelo menos um item executado.'); return }
    const texto = feitos.map(t => `✓ ${t}`).join('\n')
    setDescExec(prev => prev ? prev + '\n' + texto : texto)
  }
  const marcarTodos = () => {
    const novo = {}; procedimentoItens.forEach((_, i) => novo[i] = true); setCheck(novo)
  }
  const iniciar=async()=>{const st=statusList.find(s=>s.nome==='Em Andamento');await supabase.from('ordens_servico').update({status_id:st?.id,data_inicio:new Date().toISOString()}).eq('id',os.id);onDone()}
  const finalizar=async()=>{
    setSaving(true)
    const st=statusList.find(s=>s.nome==='Aguardando Aprovação')
    await supabase.from('ordens_servico').update({descricao_execucao:descExec,status_id:st?.id,data_conclusao:new Date().toISOString(),...(!os.data_inicio?{data_inicio:os.data_abertura}:{})}).eq('id',os.id)
    setSaving(false);onDone()
  }
  return<div>
    <div style={{background:'#F1F5F9',borderRadius:8,padding:12,marginBottom:14,borderLeft:'3px solid #3B82F6'}}>
      <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:14,fontWeight:700,color:ACCENT}}>{os.equipamentos?.nome||os.titulo}</span><span style={{color:'#64748B',fontSize:11}}>OS #{os.numero_ordem}</span></div>
      <div style={{fontSize:11,color:'#64748B',marginTop:4}}>{os.areas?.nome} · {(os.descricao||'').substring(0,80)}</div>
      <div style={{fontSize:10,color:'#94A3B8',marginTop:4}}>Solicitante: {os.solicitante||'—'} · {fmtDT(os.data_abertura)}</div>
    </div>
    {isAberta?<div style={{textAlign:'center',marginBottom:14}}>
      <button style={{...S.btnP,background:'#3B82F6',padding:'12px 24px',fontSize:14}} onClick={iniciar}>🔧 INICIAR ATENDIMENTO</button>
      <div style={{fontSize:10,color:'#94A3B8',marginTop:6}}>Registra data/hora de início</div>
    </div>:<>
      <OSMecanicos osId={os.id} mecanicos={mecanicos}/>
      {isPreventiva && procedimentoItens.length > 0 && <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:8,padding:12,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
          <div style={{fontSize:11,color:'#92400E',fontWeight:700,textTransform:'uppercase'}}>📋 Checklist do Procedimento ({Object.values(check).filter(Boolean).length}/{procedimentoItens.length})</div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={marcarTodos} style={{...S.btnS,padding:'3px 10px',fontSize:10,minHeight:24}}>✓ Todos</button>
            <button onClick={aplicarChecklist} style={{...S.btnP,padding:'3px 10px',fontSize:10,minHeight:24,background:'#F59E0B'}}>↓ Aplicar ao serviço</button>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>{procedimentoItens.map((item, i) => (
          <label key={i} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,padding:'4px 6px',cursor:'pointer',background:check[i]?'#FEF3C7':'transparent',borderRadius:4}}>
            <input type="checkbox" checked={!!check[i]} onChange={() => toggleCheck(i)} style={{marginTop:2,width:16,height:16,cursor:'pointer',flexShrink:0}}/>
            <span style={{color:check[i]?'#92400E':'#334155',textDecoration:check[i]?'line-through':'none',lineHeight:1.4}}>{item}</span>
          </label>
        ))}</div>
      </div>}
      <Field label="Descrição do Serviço Realizado"><textarea style={{...S.input,minHeight:80,resize:'vertical'}} value={descExec} onChange={e=>setDescExec(e.target.value)} placeholder="O que foi feito..."/></Field>
      <OSMateriais osId={os.id}/>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingTop:12,marginTop:10,borderTop:'1px solid #E2E8F0'}}>
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
    <div style={{background:'#F1F5F9',borderRadius:8,padding:14,marginBottom:16}}>
      <div style={{fontSize:14,fontWeight:700,color:ACCENT}}>{os.equipamentos?.nome||os.titulo}</div>
      <div style={{fontSize:12,color:'#64748B',marginTop:6}}>Solicitante: {os.solicitante}</div>
      {os.descricao&&<div style={{fontSize:12,color:'#334155',marginTop:8,lineHeight:1.5}}><strong>Problema:</strong> {os.descricao}</div>}
      {os.descricao_execucao&&<div style={{fontSize:12,color:'#2563EB',marginTop:8,lineHeight:1.5,background:'#EFF6FF',padding:10,borderRadius:6}}><strong>Serviço:</strong> {os.descricao_execucao}</div>}
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

  const imprimir = () => {
    const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    const dt = (s) => s ? new Date(s).toLocaleString('pt-BR') : ''
    const causaFalha = os.tipos_falha?.nome || ''
    const causas = ['Elétrica','Automação','Mecânica','Hidráulica','Pneumática','Predial','Limpeza']
    const chk = (v) => causaFalha === v ? '☒' : '☐'
    const matsHTML = mats.map(m => `<tr><td>${esc(m.materiais?.nome || m.descricao || '')}</td><td>${esc(m.materiais?.unidade||'')}</td><td>${esc(m.quantidade)}</td></tr>`).join('')
    const fmtMinPrint = (min) => { if (!min || min <= 0) return '—'; const h = Math.floor(min/60), mm = min%60; return h>0 ? `${h}h${mm?' '+mm+'min':''}` : `${mm}min` }
    const mecsTblHTML = osMecs.length > 0 ? `<table class="mec-tbl"><thead><tr><th>Técnico</th><th>Início</th><th>Término</th><th>Tempo</th></tr></thead><tbody>${osMecs.map(m => `<tr><td>${esc(m.mecanicos?.nome||'')}</td><td>${esc(m.data_inicio?dt(m.data_inicio):'')}</td><td>${esc(m.data_fim?dt(m.data_fim):'em and.')}</td><td><b>${fmtMinPrint(m.tempo_minutos)}</b></td></tr>`).join('')}</tbody></table>` : ''
    const mecsHTML = osMecs.map(m => esc(m.mecanicos?.nome || '')).join(', ')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OS ${os.numero_ordem||''}</title>
<style>
@page{size:A5;margin:8mm}
body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0;padding:6px}
.head{display:flex;border:2px solid #000}
.brand{background:#1E40AF;color:#fff;font-weight:900;font-size:18px;padding:8px 14px;letter-spacing:3px;line-height:1.1}
.brand .sub{font-size:7px;font-weight:400;letter-spacing:2px;opacity:.85;display:block;margin-top:2px}
.title{flex:1;text-align:center;font-weight:700;font-size:14px;padding:8px;letter-spacing:1px}
.osnum{font-weight:900;color:#C00;font-size:20px;padding:8px 14px;border-left:2px solid #000;background:#FEF2F2}
table{width:100%;border-collapse:collapse;margin-top:0}
table.grid td{border:1px solid #000;padding:3px 5px;vertical-align:top}
.lbl{font-size:8px;font-weight:700;color:#000;text-transform:uppercase}
.val{font-size:11px;min-height:14px;font-weight:600}
.sec-title{background:#000;color:#fff;font-weight:700;text-align:center;padding:3px;font-size:10px;letter-spacing:1px;margin-top:3px}
.area{border:1px solid #000;padding:5px;min-height:42px;font-size:11px;white-space:pre-wrap}
.chks{border:1px solid #000;padding:5px;display:flex;justify-content:space-around;font-size:10px;flex-wrap:wrap;gap:4px}
.chks .it{display:inline-flex;align-items:center;gap:3px}
.pend{border:1px solid #000;padding:5px;font-size:10px}
.foot{border:1px solid #000;padding:4px;font-size:9px;display:flex;justify-content:space-between;margin-top:4px}
.sigrow{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #000;margin-top:3px}
.sigrow > div{border-right:1px solid #000;padding:3px 5px;min-height:32px}
.sigrow > div:last-child{border-right:none}
.mat-tbl,.mec-tbl{margin-top:4px;border:1px solid #000;width:100%;font-size:10px;border-collapse:collapse}
.mat-tbl th,.mec-tbl th{background:#eee;border:1px solid #000;padding:2px}
.mat-tbl td,.mec-tbl td{border:1px solid #000;padding:2px}
@media print{body{padding:0}}
</style></head><body>
<div class="head">
  <div class="brand">MANUTELOS<span class="sub">GESTÃO DE MANUTENÇÃO</span></div>
  <div class="title">ORDEM DE SERVIÇO<div style="font-size:8px;font-weight:400;color:#666;letter-spacing:0;margin-top:2px">Fábrica de Algodão Telos</div></div>
  <div class="osnum">${esc(os.numero_ordem||'—')}</div>
</div>
<table class="grid"><tr>
  <td style="width:25%"><div class="lbl">Setor</div><div class="val">${esc(os.areas?.nome||'')}</div></td>
  <td style="width:35%"><div class="lbl">Máquina</div><div class="val">${esc((os.equipamentos?.codigo?os.equipamentos.codigo+' - ':'')+(os.equipamentos?.nome||''))}</div></td>
  <td style="width:20%"><div class="lbl">Data / Hora</div><div class="val">${esc(dt(os.data_abertura))}</div></td>
  <td style="width:20%"><div class="lbl">Recebido por</div><div class="val">${esc(os.recebido_por||'')}</div><div class="lbl" style="margin-top:2px">Data/Hora</div><div class="val">${esc(dt(os.data_recebimento))}</div></td>
</tr></table>
<div class="lbl" style="margin-top:4px">Descrição do Problema:</div>
<div class="area">${esc(os.descricao||'')}</div>
<div class="sec-title">CAUSA DA FALHA</div>
<div class="chks">${causas.map(c=>`<span class="it">${chk(c)} ${c}</span>`).join('')}</div>
<div class="lbl" style="margin-top:4px">Descrição do Serviço Executado:</div>
<div class="area" style="min-height:80px">${esc(os.descricao_execucao||'')}</div>
<div class="pend">
  <b>Medidas a realizar / Pendências?</b>
  ${os.tem_pendencia ? '☒ SIM ☐ NÃO' : '☐ SIM ☒ NÃO'}
  &nbsp;&nbsp;
  ${os.pendencia_melhoria?'☒':'☐'} ME - Melhoria &nbsp;
  ${os.pendencia_terceiros?'☒':'☐'} Por Conta de Terceiros &nbsp;
  ${os.pendencia_aguard_material?'☒':'☐'} Aguardando Material
</div>
<div class="lbl" style="margin-top:4px">Observações:</div>
<div class="area" style="min-height:34px">${esc(os.observacoes||'')}</div>
${mecsTblHTML}
${matsHTML?`<table class="mat-tbl"><thead><tr><th>Material</th><th>Un.</th><th>Qtd</th></tr></thead><tbody>${matsHTML}</tbody></table>`:''}
<div class="sigrow">
  <div><div class="lbl">Requisitante</div><div class="val">${esc(os.solicitante||'')}</div></div>
  <div><div class="lbl">Executado por</div><div class="val">${esc(os.executado_por||'')}</div></div>
  <div><div class="lbl">Resp. Manut.</div><div class="val">${esc(os.resp_manutencao||'')}</div></div>
  <div><div class="lbl">Liberado por</div><div class="val">${esc(os.liberado_por||'')}</div></div>
</div>
<div class="sigrow" style="grid-template-columns:1fr 1fr 1fr">
  <div><div class="lbl">Serviço Data</div><div class="val">${esc(os.data_abertura?new Date(os.data_abertura).toLocaleDateString('pt-BR'):'')}</div></div>
  <div><div class="lbl">Início</div><div class="val">${esc(dt(os.data_inicio))}</div></div>
  <div><div class="lbl">Término</div><div class="val">${esc(dt(os.data_conclusao))}</div></div>
</div>
<div style="text-align:right;font-size:8px;color:#666;margin-top:4px">FORM.MN-023 · MANUTELOS · Emitido em ${new Date().toLocaleString('pt-BR')}</div>
<script>setTimeout(()=>window.print(),250)</script>
</body></html>`
    const w = window.open('', '_blank')
    w.document.write(html); w.document.close()
  }
  const isAprov=os.status_os?.nome==='Aguardando Aprovação'
  const canApr=isAprov&&(perfil==='admin'||perfil==='gestor'||perfil==='supervisor'||perfil==='solicitante')
  const canAtend=getPermissao(perfil,'os_atender')&&os.status_os?.nome!=='Concluída'&&os.status_os?.nome!=='Aguardando Aprovação'
  const R=({l,v,a})=><div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #F1F5F9'}}>
    <span style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',fontWeight:600}}>{l}</span><span style={{fontSize:12,color:a||'#94A3B8',fontWeight:a?700:400}}>{v||'—'}</span></div>
  return<div>
    <div style={{background:'#F1F5F9',borderRadius:8,padding:16,marginBottom:14,border:'1px solid #CBD5E1'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div style={{fontSize:28,fontWeight:800,color:ACCENT,letterSpacing:3}}>Nº {os.numero_ordem||'—'}</div><StatusBadge status={os.status_os}/>
      </div>
      {os.equipamentos&&<div style={{marginBottom:6}}><div style={{fontSize:9,color:'#94A3B8',textTransform:'uppercase'}}>Equipamento</div>
        <div style={{fontSize:16,fontWeight:700,color:'#0F172A'}}>⚙️ {os.equipamentos.codigo?os.equipamentos.codigo+' - ':''}{os.equipamentos.nome}</div></div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11}}>
        <div><span style={{color:'#94A3B8'}}>LOCALIZAÇÃO: </span><span style={{color:'#334155'}}>{os.areas?.nome||'—'}</span></div>
        <div><span style={{color:'#94A3B8'}}>TIPO: </span><span style={{color:os.tipos_manutencao?.nome==='Corretiva'?'#EF4444':'#3B82F6'}}>{os.tipos_manutencao?.nome||'—'}</span></div>
      </div>
    </div>
    <R l="Solicitante" v={os.solicitante} a={ACCENT}/><R l="Data Abertura" v={fmtDT(os.data_abertura)}/>
    {os.recebido_por&&<R l="Recebido por" v={os.recebido_por}/>}
    {os.data_recebimento&&<R l="Data Recebimento" v={fmtDT(os.data_recebimento)}/>}
    {os.tipos_falha&&<R l="Causa da Falha" v={os.tipos_falha.nome}/>}
    <R l="Prioridade" v={({Critica:'🔴 Crítica',Alta:'🟠 Alta',Media:'🟡 Média',Baixa:'🟢 Baixa'})[os.prioridade]}/>
    {os.executado_por&&<R l="Executado por" v={os.executado_por}/>}
    {os.resp_manutencao&&<R l="Resp. Manutenção" v={os.resp_manutencao}/>}
    {os.liberado_por&&<R l="Liberado por" v={os.liberado_por}/>}
    {osMecs.length>0&&<div style={{padding:'8px 0',borderBottom:'1px solid #F1F5F9'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <span style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',fontWeight:600}}>Técnicos & Tempo</span>
        <span style={{fontSize:11,color:ACCENT,fontWeight:700}}>Total: {Math.round(osMecs.reduce((s,m)=>s+(m.tempo_minutos||0),0)/60*10)/10}h</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:4}}>{osMecs.map(m=>{
        const min=m.tempo_minutos||0, h=Math.floor(min/60), mm=min%60
        const t = min>0 ? (h>0?`${h}h${mm?' '+mm+'min':''}`:`${mm}min`) : '—'
        return <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#F8FAFC',padding:'6px 10px',borderRadius:6,fontSize:11,flexWrap:'wrap',gap:6}}>
          <span style={{color:'#0F172A',fontWeight:600}}>🔧 {m.mecanicos?.nome}</span>
          <span style={{color:'#64748B'}}>{m.data_inicio?fmtDT(m.data_inicio):'—'} → {m.data_fim?fmtDT(m.data_fim):'em andamento'}</span>
          <span style={{color:ACCENT,fontWeight:700}}>⏱ {t}</span>
        </div>
      })}</div>
    </div>}
    {os.descricao&&<div style={{marginTop:10}}><div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Descrição da Solicitação</div>
      <div style={{fontSize:12,color:'#334155',lineHeight:1.6,background:'#F1F5F9',padding:12,borderRadius:6}}>{os.descricao}</div></div>}
    <div style={{marginTop:12,background:'#EFF6FF',border:'1px solid #DBEAFE',borderRadius:8,padding:14}}>
      <div style={{fontSize:10,color:'#3B82F6',textTransform:'uppercase',fontWeight:600,marginBottom:8}}>Apontamento da Execução</div>
      <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:'4px 14px',fontSize:11}}>
        <div><span style={{color:'#94A3B8'}}>INÍCIO: </span><span style={{color:'#334155'}}>{fmtDT(os.data_inicio)||'—'}</span></div>
        <div><span style={{color:'#94A3B8'}}>FIM: </span><span style={{color:'#334155'}}>{fmtDT(os.data_conclusao)||'—'}</span></div>
      </div>
      {os.descricao_execucao&&<div style={{marginTop:8}}><div style={{fontSize:9,color:'#94A3B8',marginBottom:3}}>SERVIÇO REALIZADO:</div><div style={{fontSize:12,color:'#0F172A',lineHeight:1.5}}>{os.descricao_execucao}</div></div>}
    </div>
    {os.tem_pendencia&&<div style={{marginTop:10,background:'#FFFBEB',border:'1px solid #F59E0B',borderRadius:8,padding:12}}>
      <div style={{fontSize:10,color:'#92400E',textTransform:'uppercase',fontWeight:700,marginBottom:6}}>⚠️ Pendências</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:11}}>
        {os.pendencia_melhoria&&<span style={{...badge('#F59E0B'),fontSize:11}}>ME - Melhoria</span>}
        {os.pendencia_terceiros&&<span style={{...badge('#F59E0B'),fontSize:11}}>Por Conta de Terceiros</span>}
        {os.pendencia_aguard_material&&<span style={{...badge('#F59E0B'),fontSize:11}}>Aguardando Material</span>}
      </div>
    </div>}
    {mats.length>0&&<div style={{marginTop:12}}><div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',fontWeight:600,marginBottom:6}}>📦 Materiais / Diversos</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{...S.th,fontSize:9,padding:'4px 6px'}}>Descrição</th><th style={{...S.th,fontSize:9,padding:'4px 6px'}}>Un.</th><th style={{...S.th,fontSize:9,padding:'4px 6px'}}>Qtde</th></tr></thead>
      <tbody>{mats.map(m=><tr key={m.id}><td style={{...S.td,fontSize:11,padding:'4px 6px'}}>{m.materiais?.nome||m.descricao}</td><td style={{...S.td,fontSize:11,padding:'4px 6px',color:'#64748B'}}>{m.materiais?.unidade}</td><td style={{...S.td,fontSize:11,padding:'4px 6px',color:'#3B82F6',fontWeight:700}}>{m.quantidade}</td></tr>)}</tbody></table></div>}
    {canApr&&<div style={{marginTop:14,background:'#FFFBEB',border:'1px solid #F59E0B',borderRadius:8,padding:14,textAlign:'center'}}>
      <div style={{fontSize:13,fontWeight:700,color:'#F59E0B',marginBottom:8}}>⏳ Aguardando aprovação</div>
      <div style={{display:'flex',gap:10,justifyContent:'center'}}>
        <button style={{...S.btnP,background:'#22C55E',padding:'10px 20px'}} onClick={onAprovar}>✅ Aprovar</button>
        <button style={{...S.btnP,background:'#EF4444',padding:'10px 20px'}} onClick={onAprovar}>↩️ Devolver</button>
      </div>
    </div>}
    <div style={{display:'flex',justifyContent:'flex-end',paddingTop:14,marginTop:12,borderTop:'1px solid #E2E8F0',gap:8,flexWrap:'wrap'}}>
      <button data-print-os style={{...S.btnS,color:'#A855F7',borderColor:'#A855F7'}} onClick={imprimir}>🖨️ Imprimir</button>
      {canAtend&&<button style={{...S.btnP,background:'#3B82F6'}} onClick={onAtender}>🔧 Atender</button>}
      {getPermissao(perfil,'os_editar')&&<button style={S.btnP} onClick={onEdit}>✏️ Editar</button>}
    </div>
  </div>
}
