import React, { useState, useMemo, useEffect } from 'react'
import { useOrdens, useLookups, useOSHistorico, useViewport } from '../hooks/useData'
import { S, badge, StatusBadge, PrioBadge, Modal, Field, Empty, Search, Confirm, Header, Loading, fmtDate, fmtDT, fmtHrs } from '../components/UI'
import { PRIORIDADES, PRIO_LABEL, ACCENT } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { useUser } from '../App'

export default function OrdensServico({ initialStatusFilter, onClearFilter }) {
  const { data: ordens, loading, insert, update, remove, refetch } = useOrdens()
  const { areas, statusList, tiposMan, tiposFalha, mecanicos, equipamentos } = useLookups()
  const vp = useViewport()
  const { user, perfil } = useUser()
  const [search, setSearch] = useState('')
  const [fStatus, setFS] = useState('TODOS')
  const [fArea, setFA] = useState('TODOS')
  const [modal, setModal] = useState(null) // nova | editar | ver | atender
  const [os, setOs] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showF, setShowF] = useState(false)

  useEffect(() => {
    if (initialStatusFilter && statusList.length > 0) {
      const st = statusList.find(s => s.nome === initialStatusFilter)
      if (st) setFS(st.id)
    }
  }, [initialStatusFilter, statusList])

  const filtered = useMemo(() => ordens.filter(o => {
    if (fStatus !== 'TODOS' && o.status_os?.id !== fStatus) return false
    if (fArea !== 'TODOS' && o.areas?.id !== fArea) return false
    if (search) {
      const s = search.toLowerCase()
      return (o.titulo || '').toLowerCase().includes(s) || (o.equipamentos?.nome || '').toLowerCase().includes(s) ||
        (o.descricao || '').toLowerCase().includes(s) || (o.executado_por || '').toLowerCase().includes(s) ||
        (o.solicitante || '').toLowerCase().includes(s)
    }
    return true
  }), [ordens, search, fStatus, fArea])

  const novaOS = () => {
    setOs({
      equipamento_id: '', area_id: '', tipo_manutencao_id: '', tipo_falha_id: '',
      descricao: '', prioridade: 'Media', solicitante: '', observacoes: '',
      status_id: statusList.find(s => s.nome === 'Aberta')?.id || '',
      mecanico_responsavel_id: '',
    })
    setModal('nova')
  }

  const salvar = async () => {
    setSaving(true)
    const d = { ...os }
    // Remove joined objects
    ;['areas', 'equipamentos', 'mecanicos', 'status_os', 'tipos_manutencao', 'tipos_falha', 'os_historico'].forEach(k => delete d[k])
    Object.keys(d).forEach(k => { if (d[k] === '') d[k] = null })

    // Auto-generate titulo from equipment + type
    const eq = equipamentos.find(e => e.id === d.equipamento_id)
    const tipo = tiposMan.find(t => t.id === d.tipo_manutencao_id)
    const area = areas.find(a => a.id === d.area_id)
    d.titulo = eq ? `${eq.nome}${eq.codigo ? ' (' + eq.codigo + ')' : ''}` : (area ? `${tipo?.nome || 'Manutenção'} - ${area.nome}` : d.descricao?.substring(0, 100) || 'OS')

    if (modal === 'nova') {
      const { row } = await insert(d)
    } else {
      const old = ordens.find(o => o.id === d.id)?.status_os?.nome
      const nw = statusList.find(s => s.id === d.status_id)?.nome
      await update(d.id, d, old, nw)
    }
    setSaving(false); setModal(null)
  }

  if (loading) return <Loading />

  const activeFilter = fStatus !== 'TODOS' ? statusList.find(s => s.id === fStatus)?.nome : null
  const isSolic = perfil === 'solicitante'
  const isMec = perfil === 'mecanico'

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
      <h1 style={{ margin: 0, fontFamily: "'Bebas Neue',sans-serif", fontSize: vp.isMobile ? 22 : 30, letterSpacing: 2, color: ACCENT }}>ORDENS DE SERVIÇO</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={S.btnP} onClick={novaOS}>{isSolic ? '📝 ABRIR OS' : vp.isMobile ? '+ NOVA' : '+ NOVA OS'}</button>
      </div>
    </div>

    {activeFilter && <div style={{ background: '#1E3A5F', border: '1px solid #3B82F6', borderRadius: 8, padding: '8px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: '#93C5FD' }}>Filtrado: <strong>{activeFilter}</strong> ({filtered.length})</span>
      <button style={{ ...S.btnS, padding: '3px 8px', minHeight: 26, fontSize: 10 }} onClick={() => { setFS('TODOS'); onClearFilter?.() }}>✕</button>
    </div>}

    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Search value={search} onChange={setSearch} ph="Buscar equipamento, solicitante, descrição..." />
      {!vp.isMobile && <>
        <select style={{ ...S.select, width: 170 }} value={fStatus} onChange={e => setFS(e.target.value)}><option value="TODOS">Todos Status</option>{statusList.map(s => <option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select>
        <select style={{ ...S.select, width: 150 }} value={fArea} onChange={e => setFA(e.target.value)}><option value="TODOS">Todas Áreas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
      </>}
      {vp.isMobile && <button style={S.btnS} onClick={() => setShowF(!showF)}>🔽</button>}
      <span style={{ fontSize: 10, color: '#555' }}>{filtered.length}/{ordens.length}</span>
    </div>
    {vp.isMobile && showF && <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
      <select style={S.select} value={fStatus} onChange={e => setFS(e.target.value)}><option value="TODOS">Todos Status</option>{statusList.map(s => <option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}</select>
      <select style={S.select} value={fArea} onChange={e => setFA(e.target.value)}><option value="TODOS">Todas Áreas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
    </div>}

    {filtered.length === 0 ? <Empty icon="📋" msg="Nenhuma OS" action={isSolic ? 'Abrir OS' : 'Criar OS'} onAction={novaOS} /> :
      vp.isMobile ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{filtered.slice(0, 100).map(o =>
        <div key={o.id} style={S.card} onClick={() => { setOs({ ...o }); setModal('ver') }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            {o.equipamentos?.nome ? <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>⚙️ {o.equipamentos.nome}</span> : <span style={{ fontSize: 12, color: '#888' }}>Sem equipamento</span>}
            <PrioBadge p={o.prioridade} />
          </div>
          <div style={{ fontSize: 12, color: '#CCC', marginBottom: 4, lineHeight: 1.3 }}>{(o.descricao || o.titulo || '').substring(0, 80)}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={o.status_os} />
            <span style={{ fontSize: 10, color: '#888' }}>{o.areas?.nome || ''}</span>
            {o.solicitante && <span style={{ fontSize: 10, color: '#666' }}>📝 {o.solicitante}</span>}
            <span style={{ fontSize: 9, color: '#555' }}>{fmtDate(o.data_abertura)}</span>
          </div>
        </div>
      )}</div> :
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>
        <th style={S.th}>Equipamento</th><th style={S.th}>Descrição</th><th style={S.th}>Área</th>
        <th style={S.th}>Status</th><th style={S.th}>Solicitante</th><th style={S.th}>Data</th><th style={S.th}></th>
      </tr></thead><tbody>{filtered.slice(0, 200).map(o =>
        <tr key={o.id} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#1A1A1E'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <td style={{ ...S.td, color: ACCENT, fontWeight: 600 }}>{o.equipamentos?.nome || '—'}{o.equipamentos?.codigo ? <span style={{ fontSize: 10, color: '#666' }}> ({o.equipamentos.codigo})</span> : ''}</td>
          <td style={{ ...S.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{o.descricao || o.titulo || '—'}</td>
          <td style={{ ...S.td, fontSize: 12 }}>{o.areas?.nome || '—'}</td>
          <td style={S.td}><StatusBadge status={o.status_os} /></td>
          <td style={{ ...S.td, fontSize: 11, color: '#999' }}>{o.solicitante || '—'}</td>
          <td style={{ ...S.td, fontSize: 11, color: '#999' }}>{fmtDate(o.data_abertura)}</td>
          <td style={S.td}><div style={{ display: 'flex', gap: 4 }}>
            <button style={{ ...S.btnS, padding: '4px 8px', minHeight: 30 }} onClick={e => { e.stopPropagation(); setOs({ ...o }); setModal('ver') }}>👁</button>
            {!isSolic && <button style={{ ...S.btnS, padding: '4px 8px', minHeight: 30 }} onClick={e => { e.stopPropagation(); setOs({ ...o }); setModal('editar') }}>✏️</button>}
            {isMec && o.status_os?.nome !== 'Concluída' && <button style={{ ...S.btnS, padding: '4px 8px', minHeight: 30, color: '#3B82F6', borderColor: '#3B82F6' }} onClick={e => { e.stopPropagation(); setOs({ ...o }); setModal('atender') }}>🔧</button>}
          </div></td>
        </tr>
      )}</tbody></table>
        {filtered.length > 200 && <div style={{ textAlign: 'center', padding: 8, color: '#666', fontSize: 10 }}>200 de {filtered.length} — use filtros</div>}
      </div>
    }

    {/* Modal: Nova OS / Editar */}
    <Modal open={modal === 'nova' || modal === 'editar'} onClose={() => setModal(null)} title={modal === 'nova' ? (isSolic ? 'ABRIR ORDEM DE SERVIÇO' : 'NOVA OS') : 'EDITAR OS'} mobile={vp.isMobile}>
      {os && <OSForm os={os} setOs={setOs} onSave={salvar} onCancel={() => setModal(null)}
        onDel={modal === 'editar' && !isSolic ? () => setConfirm({ msg: 'Excluir?', ok: async () => { await remove(os.id); setConfirm(null); setModal(null) } }) : null}
        areas={areas} equipamentos={equipamentos} mecanicos={mecanicos} statusList={statusList}
        tiposMan={tiposMan} tiposFalha={tiposFalha} isEdit={modal === 'editar'} saving={saving}
        mobile={vp.isMobile} perfil={perfil} />}
    </Modal>

    {/* Modal: Atender OS (mecânico) */}
    <Modal open={modal === 'atender'} onClose={() => setModal(null)} title="🔧 ATENDER OS" mobile={vp.isMobile}>
      {os && <AtenderOS os={os} statusList={statusList} mecanicos={mecanicos} onDone={async () => { await refetch(); setModal(null) }} mobile={vp.isMobile} />}
    </Modal>

    {/* Modal: Ver OS */}
    <Modal open={modal === 'ver'} onClose={() => setModal(null)} title={os?.equipamentos?.nome || 'Detalhes da OS'} mobile={vp.isMobile}>
      {os && <OSDetail os={os} onEdit={() => setModal(isMec ? 'atender' : 'editar')} mobile={vp.isMobile} perfil={perfil} />}
    </Modal>

    <Confirm open={!!confirm} msg={confirm?.msg} onOk={confirm?.ok} onNo={() => setConfirm(null)} />
  </div>
}

// ── Formulário de OS ──
function OSForm({ os, setOs, onSave, onCancel, onDel, areas, equipamentos, mecanicos, statusList, tiposMan, tiposFalha, isEdit, saving, mobile, perfil }) {
  const u = (f, v) => setOs({ ...os, [f]: v })
  const g = mobile ? '1fr' : '1fr 1fr'
  const isSolic = perfil === 'solicitante'

  // Filter equipment by area
  const filteredEquip = useMemo(() => {
    if (os.area_id) { const ae = equipamentos.filter(e => e.area_id === os.area_id); if (ae.length > 0) return ae }
    return equipamentos
  }, [equipamentos, os.area_id])

  // Validation
  const missing = []
  if (!os.equipamento_id && !os.descricao?.trim()) missing.push('Equipamento ou Descrição')
  if (!(os.solicitante || '').trim()) missing.push('Solicitante')
  if (!os.tipo_manutencao_id) missing.push('Tipo Manutenção')
  if (!os.area_id) missing.push('Área')
  const canSave = missing.length === 0

  return <div>
    {/* Equipamento em destaque no topo */}
    <div style={{ background: '#1A1A1E', borderRadius: 8, padding: 14, marginBottom: 16, borderLeft: `3px solid ${ACCENT}` }}>
      <Field label="Equipamento" req>
        <select style={{ ...S.select, fontSize: 15, padding: '12px 14px', fontWeight: 600 }} value={os.equipamento_id || ''} onChange={e => u('equipamento_id', e.target.value)}>
          <option value="">Selecione o equipamento</option>
          {filteredEquip.map(e => <option key={e.id} value={e.id}>{e.nome}{e.codigo ? ` (${e.codigo})` : ''}</option>)}
        </select>
      </Field>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: g, gap: '0 14px' }}>
      <Field label="Solicitante" req><input style={S.input} value={os.solicitante || ''} onChange={e => u('solicitante', e.target.value)} placeholder="Quem está solicitando" /></Field>
      <Field label="Tipo Manutenção" req><select style={{ ...S.select, borderColor: !os.tipo_manutencao_id ? '#5E1F1F' : undefined }} value={os.tipo_manutencao_id || ''} onChange={e => u('tipo_manutencao_id', e.target.value)}>
        <option value="">Selecione *</option>{tiposMan.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select></Field>
      <Field label="Área" req><select style={{ ...S.select, borderColor: !os.area_id ? '#5E1F1F' : undefined }} value={os.area_id || ''} onChange={e => u('area_id', e.target.value)}>
        <option value="">Selecione *</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
      </select></Field>
      {!isSolic && <Field label="Tipo Falha"><select style={S.select} value={os.tipo_falha_id || ''} onChange={e => u('tipo_falha_id', e.target.value)}>
        <option value="">Selecione</option>{tiposFalha.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select></Field>}
      <Field label="Prioridade"><select style={S.select} value={os.prioridade || 'Media'} onChange={e => u('prioridade', e.target.value)}>
        {Object.entries(PRIO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select></Field>
      {isEdit && !isSolic && <Field label="Status"><select style={S.select} value={os.status_id || ''} onChange={e => u('status_id', e.target.value)}>
        {statusList.map(s => <option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}
      </select></Field>}
      {!isSolic && <Field label="Mecânico"><select style={S.select} value={os.mecanico_responsavel_id || ''} onChange={e => u('mecanico_responsavel_id', e.target.value)}>
        <option value="">Não atribuído</option>{mecanicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select></Field>}
    </div>

    <Field label="Descrição do Problema / Serviço" req><textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} value={os.descricao || ''} onChange={e => u('descricao', e.target.value)} placeholder="Descreva detalhadamente o problema ou serviço necessário" /></Field>
    {!isSolic && <Field label="Observações"><textarea style={{ ...S.input, minHeight: 50, resize: 'vertical' }} value={os.observacoes || ''} onChange={e => u('observacoes', e.target.value)} /></Field>}

    {missing.length > 0 && <div style={{ background: '#422006', border: '1px solid #F59E0B', borderRadius: 6, padding: '8px 12px', marginTop: 8, fontSize: 11, color: '#F59E0B' }}>Campos obrigatórios: {missing.join(', ')}</div>}

    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #1F1F23', gap: 10, flexWrap: 'wrap' }}>
      <div>{onDel && <button style={S.btnD} onClick={onDel}>Excluir</button>}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={S.btnS} onClick={onCancel}>Cancelar</button>
        <button style={{ ...S.btnP, opacity: canSave && !saving ? 1 : .4 }} onClick={canSave ? onSave : undefined} disabled={saving || !canSave}>
          {saving ? 'Salvando...' : isSolic ? 'Abrir OS' : isEdit ? 'Salvar' : 'Criar OS'}
        </button>
      </div>
    </div>
  </div>
}

// ── Atender OS (visão mecânico) ──
function AtenderOS({ os, statusList, mecanicos, onDone, mobile }) {
  const [descExec, setDescExec] = useState(os.descricao_execucao || '')
  const [statusId, setStatusId] = useState(os.status_id || '')
  const [saving, setSaving] = useState(false)
  // Materiais utilizados
  const [mats, setMats] = useState([])
  const [allMats, setAllMats] = useState([])
  const [matSel, setMatSel] = useState('')
  const [matQtd, setMatQtd] = useState(1)

  useEffect(() => {
    // Load existing materials for this OS
    supabase.from('os_materiais').select('*,materiais(nome,codigo,unidade)').eq('ordem_servico_id', os.id).then(({ data }) => setMats(data || []))
    // Load all materials for picker
    supabase.from('materiais').select('id,nome,codigo,unidade,quantidade').order('nome').then(({ data }) => setAllMats(data || []))
  }, [os.id])

  const addMat = async () => {
    if (!matSel || matQtd <= 0) return
    const mat = allMats.find(m => m.id === matSel)
    if (!mat) return
    // Insert into os_materiais
    const { data: row } = await supabase.from('os_materiais').insert({
      ordem_servico_id: os.id, material_id: mat.id, descricao: mat.nome,
      quantidade: matQtd, custo_unitario: 0, custo_total: 0,
    }).select('*,materiais(nome,codigo,unidade)').single()
    if (row) {
      setMats(p => [...p, row])
      // Decrease stock
      await supabase.from('materiais').update({ quantidade: Math.max(0, mat.quantidade - matQtd) }).eq('id', mat.id)
      await supabase.from('movimentacao_estoque').insert({ material_id: mat.id, tipo: 'saida', quantidade: matQtd, observacoes: `OS ${os.titulo || os.id}`, usuario: 'Mecânico' })
    }
    setMatSel(''); setMatQtd(1)
  }

  const removeMat = async (matOS) => {
    await supabase.from('os_materiais').delete().eq('id', matOS.id)
    setMats(p => p.filter(m => m.id !== matOS.id))
    // Return to stock
    if (matOS.material_id) {
      const mat = allMats.find(m => m.id === matOS.material_id)
      if (mat) await supabase.from('materiais').update({ quantidade: mat.quantidade + (matOS.quantidade || 0) }).eq('id', mat.id)
    }
  }

  const salvarAtendimento = async () => {
    setSaving(true)
    const updates = { descricao_execucao: descExec, status_id: statusId }
    // If concluding, set dates
    const stNome = statusList?.find(s => s.id === statusId)?.nome
    if (stNome === 'Concluída') {
      updates.data_conclusao = new Date().toISOString()
      if (!os.data_inicio) updates.data_inicio = os.data_abertura
    }
    if (stNome === 'Em Andamento' && !os.data_inicio) {
      updates.data_inicio = new Date().toISOString()
    }
    await supabase.from('ordens_servico').update(updates).eq('id', os.id)
    // History
    await supabase.from('os_historico').insert({ ordem_servico_id: os.id, acao: `Atendimento: ${stNome}. ${mats.length} materiais utilizados.`, usuario: 'Mecânico' })
    setSaving(false)
    onDone()
  }

  return <div>
    {/* OS info */}
    <div style={{ background: '#1A1A1E', borderRadius: 8, padding: 12, marginBottom: 14, borderLeft: '3px solid #3B82F6' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>{os.equipamentos?.nome || os.titulo}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{os.areas?.nome} · {os.descricao?.substring(0, 100)}</div>
      <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Solicitante: {os.solicitante || '—'} · Abertura: {fmtDT(os.data_abertura)}</div>
    </div>

    <Field label="Status da OS"><select style={S.select} value={statusId} onChange={e => setStatusId(e.target.value)}>
      {statusList.map(s => <option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}
    </select></Field>

    <Field label="Descrição do Serviço Realizado" req>
      <textarea style={{ ...S.input, minHeight: 100, resize: 'vertical' }} value={descExec} onChange={e => setDescExec(e.target.value)} placeholder="Descreva o que foi feito, peças trocadas, ajustes realizados..." />
    </Field>

    {/* Materiais utilizados */}
    <div style={{ background: '#1A1A1E', borderRadius: 8, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>📦 Materiais Utilizados ({mats.length})</div>

      {mats.length > 0 && <div style={{ marginBottom: 12 }}>
        {mats.map(m => <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #222' }}>
          <div>
            <span style={{ fontSize: 12, color: '#E5E5E5' }}>{m.materiais?.nome || m.descricao}</span>
            <span style={{ fontSize: 10, color: ACCENT, marginLeft: 6 }}>({m.materiais?.codigo})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 700 }}>{m.quantidade} {m.materiais?.unidade}</span>
            <button style={{ ...S.btnS, padding: '2px 6px', minHeight: 24, fontSize: 10, color: '#EF4444', borderColor: '#5E1F1F' }} onClick={() => removeMat(m)}>✕</button>
          </div>
        </div>)}
      </div>}

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <select style={{ ...S.select, fontSize: 11 }} value={matSel} onChange={e => setMatSel(e.target.value)}>
            <option value="">Selecione material...</option>
            {allMats.map(m => <option key={m.id} value={m.id}>{m.nome} ({m.codigo}) — Est: {m.quantidade}</option>)}
          </select>
        </div>
        <input style={{ ...S.input, width: 60, textAlign: 'center', marginBottom: 0 }} type="number" min="1" value={matQtd} onChange={e => setMatQtd(parseInt(e.target.value) || 1)} />
        <button style={{ ...S.btnP, padding: '8px 14px', fontSize: 11 }} onClick={addMat}>+ Adicionar</button>
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: '1px solid #1F1F23' }}>
      <button style={{ ...S.btnP, background: '#22C55E' }} onClick={salvarAtendimento} disabled={saving}>
        {saving ? 'Salvando...' : '✅ Salvar Atendimento'}
      </button>
    </div>
  </div>
}

// ── Detalhes da OS ──
function OSDetail({ os, onEdit, mobile, perfil }) {
  const hist = useOSHistorico(os.id)
  const [mats, setMats] = useState([])
  const isSolic = perfil === 'solicitante'

  useEffect(() => {
    supabase.from('os_materiais').select('*,materiais(nome,codigo,unidade)').eq('ordem_servico_id', os.id).then(({ data }) => setMats(data || []))
  }, [os.id])

  return <div>
    {/* Equipamento destaque */}
    {os.equipamentos && <div style={{ background: '#1A1A1E', borderRadius: 8, padding: 12, marginBottom: 14, borderLeft: `3px solid ${ACCENT}` }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT }}>⚙️ {os.equipamentos.nome}</div>
      {os.equipamentos.codigo && <div style={{ fontSize: 12, color: '#888' }}>Código: {os.equipamentos.codigo}{os.equipamentos.tag ? ` · TAG: ${os.equipamentos.tag}` : ''}</div>}
    </div>}

    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
      <StatusBadge status={os.status_os} /><PrioBadge p={os.prioridade} />
      {os.tipos_manutencao && <span style={badge('#888')}>{os.tipos_manutencao.nome}</span>}
      {os.tipos_falha && <span style={badge('#888')}>{os.tipos_falha.nome}</span>}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '8px 14px', marginBottom: 14 }}>
      {[
        ['Área', os.areas?.nome], ['Solicitante', os.solicitante],
        ['Mecânico', os.mecanicos?.nome || 'Não atribuído'], ['Executado por', os.executado_por],
        ['Abertura', fmtDT(os.data_abertura)], ['Início', fmtDT(os.data_inicio)],
        ['Conclusão', fmtDT(os.data_conclusao)],
        ...(os.tempo_execucao_min ? [['Tempo Execução', `${os.tempo_execucao_min} min`]] : []),
      ].map(([l, v]) => <div key={l}><div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div><div style={{ fontSize: 12, color: '#CCC' }}>{v || '—'}</div></div>)}
    </div>

    {os.descricao && <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Descrição do Problema</div>
      <div style={{ fontSize: 12, color: '#CCC', lineHeight: 1.5, background: '#1A1A1E', padding: 10, borderRadius: 6, maxHeight: 120, overflow: 'auto' }}>{os.descricao}</div>
    </div>}

    {os.descricao_execucao && <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Serviço Realizado</div>
      <div style={{ fontSize: 12, color: '#CCC', lineHeight: 1.5, background: '#0D2137', padding: 10, borderRadius: 6, border: '1px solid #1E3A5F', maxHeight: 120, overflow: 'auto' }}>{os.descricao_execucao}</div>
    </div>}

    {/* Materiais utilizados */}
    {mats.length > 0 && <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 6 }}>📦 Materiais Utilizados ({mats.length})</div>
      <div style={{ background: '#1A1A1E', borderRadius: 6, padding: 10 }}>
        {mats.map(m => <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #222', fontSize: 12 }}>
          <span style={{ color: '#CCC' }}>{m.materiais?.nome || m.descricao} <span style={{ color: ACCENT }}>({m.materiais?.codigo})</span></span>
          <span style={{ color: '#3B82F6', fontWeight: 700 }}>{m.quantidade} {m.materiais?.unidade}</span>
        </div>)}
      </div>
    </div>}

    {hist.length > 0 && <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 6 }}>Histórico</div>
      <div style={{ borderLeft: '2px solid #2A2A30', marginLeft: 6, paddingLeft: 12 }}>
        {hist.map((h, i) => <div key={h.id} style={{ marginBottom: 8, position: 'relative' }}>
          <div style={{ position: 'absolute', left: -18, top: 3, width: 6, height: 6, borderRadius: '50%', background: i === 0 ? ACCENT : '#2A2A30' }} />
          <div style={{ fontSize: 10, color: '#666' }}>{fmtDT(h.created_at)}</div>
          <div style={{ fontSize: 11, color: '#CCC' }}>{h.acao}</div>
        </div>)}
      </div>
    </div>}

    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #1F1F23', gap: 8 }}>
      {isSolic ? <span style={{ fontSize: 11, color: '#666' }}>Acompanhe o status da sua OS acima</span> :
        <button style={S.btnP} onClick={onEdit}>{perfil === 'mecanico' ? '🔧 Atender' : '✏️ Editar'}</button>}
    </div>
  </div>
}
