import React, { useState, useMemo } from 'react'
import { useOrdens, useTable, useLookups, useOSHistorico, useViewport } from '../hooks/useData'
import { S, badge, StatusBadge, PrioridadeBadge, Modal, FormField, EmptyState, SearchBar, ConfirmDialog, PageHeader, Loading, fmtDate, fmtDateTime } from '../components/UI'
import { PRIORIDADES, ACCENT, FONT_DISPLAY } from '../lib/constants'

export default function OrdensServico() {
  const { data: ordens, loading, insert, update, remove } = useOrdens()
  const { data: equipamentos } = useTable('equipamentos', { order: 'nome', ascending: true })
  const { data: mecanicos } = useTable('mecanicos', { order: 'nome', ascending: true })
  const { areas, statusList, tiposMan, tiposFalha } = useLookups()
  const vp = useViewport()

  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [filtroArea, setFiltroArea] = useState('TODOS')
  const [modal, setModal] = useState(null)
  const [osAtual, setOsAtual] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    return ordens.filter(o => {
      if (filtroStatus !== 'TODOS' && o.status_os?.id !== filtroStatus) return false
      if (filtroArea !== 'TODOS' && o.areas?.id !== filtroArea) return false
      if (search) {
        const s = search.toLowerCase()
        return (o.titulo || '').toLowerCase().includes(s) || (o.numero_ordem_legado || '').includes(s) || (o.descricao || '').toLowerCase().includes(s)
      }
      return true
    })
  }, [ordens, search, filtroStatus, filtroArea])

  const novaOS = () => {
    setOsAtual({
      titulo: '', descricao: '', prioridade: 'Media',
      status_id: statusList.find(s => s.nome === 'Aberta')?.id || '',
      area_id: '', equipamento_id: '', mecanico_responsavel_id: '',
      tipo_manutencao_id: '', tipo_falha_id: '', solicitante: '', observacoes: '',
    })
    setModal('nova')
  }

  const salvarOS = async () => {
    setSaving(true)
    const data = { ...osAtual }
    // Clean empty strings to null
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null })
    delete data.areas; delete data.equipamentos; delete data.mecanicos; delete data.status_os; delete data.tipos_manutencao; delete data.tipos_falha

    if (modal === 'nova') {
      await insert(data)
    } else {
      const oldStatus = ordens.find(o => o.id === data.id)?.status_os?.nome
      const newStatus = statusList.find(s => s.id === data.status_id)?.nome
      await update(data.id, data, oldStatus, newStatus)
    }
    setSaving(false)
    setModal(null)
  }

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader title="ORDENS DE SERVIÇO" action={novaOS} actionLabel={vp.isMobile ? '+ NOVA' : '+ NOVA OS'} isMobile={vp.isMobile} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar nº, título..." />
        {vp.isMobile ? (
          <button style={S.btnSecondary} onClick={() => setShowFilters(!showFilters)}>🔽 Filtros</button>
        ) : (<>
          <select style={{ ...S.select, width: 180 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="TODOS">Todos Status</option>
            {statusList.map(s => <option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}
          </select>
          <select style={{ ...S.select, width: 160 }} value={filtroArea} onChange={e => setFiltroArea(e.target.value)}>
            <option value="TODOS">Todas Áreas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </>)}
        <span style={{ fontSize: 11, color: '#555' }}>{filtered.length} resultado(s)</span>
      </div>

      {vp.isMobile && showFilters && (
        <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <select style={S.select} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="TODOS">Todos Status</option>
            {statusList.map(s => <option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}
          </select>
          <select style={S.select} value={filtroArea} onChange={e => setFiltroArea(e.target.value)}>
            <option value="TODOS">Todas Áreas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
      )}

      {filtered.length === 0 ? <EmptyState icon="📋" message="Nenhuma OS encontrada" action="Criar Nova OS" onAction={novaOS} /> : (
        vp.isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(o => (
              <div key={o.id} style={S.card} onClick={() => { setOsAtual({ ...o }); setModal('ver') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: ACCENT, fontWeight: 700, fontSize: 12 }}>#{o.numero_ordem_legado || o.id.slice(0,6)}</span>
                  <PrioridadeBadge prioridade={o.prioridade} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#E5E5E5', marginBottom: 8, lineHeight: 1.3 }}>{o.titulo || 'Sem título'}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <StatusBadge status={o.status_os} />
                  <span style={{ fontSize: 12, color: '#888' }}>{o.areas?.nome || ''}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={S.th}>Nº</th><th style={S.th}>Título</th><th style={S.th}>Área</th>
                <th style={S.th}>Status</th><th style={S.th}>Prioridade</th><th style={S.th}>Data</th><th style={S.th}>Ações</th>
              </tr></thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1A1A1E'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...S.td, color: ACCENT, fontWeight: 700 }}>#{o.numero_ordem_legado || o.id.slice(0,6)}</td>
                    <td style={{ ...S.td, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titulo || '—'}</td>
                    <td style={S.td}>{o.areas?.nome || '—'}</td>
                    <td style={S.td}><StatusBadge status={o.status_os} /></td>
                    <td style={S.td}><PrioridadeBadge prioridade={o.prioridade} /></td>
                    <td style={{ ...S.td, fontSize: 12, color: '#999' }}>{fmtDate(o.data_abertura)}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ ...S.btnSecondary, padding: '6px 10px', minHeight: 36 }} onClick={() => { setOsAtual({ ...o }); setModal('ver') }}>👁</button>
                        <button style={{ ...S.btnSecondary, padding: '6px 10px', minHeight: 36 }} onClick={() => { setOsAtual({ ...o }); setModal('editar') }}>✏️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal Form */}
      <Modal open={modal === 'nova' || modal === 'editar'} onClose={() => setModal(null)} title={modal === 'nova' ? 'NOVA OS' : 'EDITAR OS'} isMobile={vp.isMobile}>
        {osAtual && <OSForm os={osAtual} setOs={setOsAtual} onSave={salvarOS} onCancel={() => setModal(null)}
          onDelete={modal === 'editar' ? () => setConfirm({ message: 'Excluir esta OS?', onConfirm: async () => { await remove(osAtual.id); setConfirm(null); setModal(null) } }) : null}
          areas={areas} equipamentos={equipamentos} mecanicos={mecanicos} statusList={statusList} tiposMan={tiposMan} tiposFalha={tiposFalha}
          isEdit={modal === 'editar'} saving={saving} isMobile={vp.isMobile} />}
      </Modal>

      {/* Modal View */}
      <Modal open={modal === 'ver'} onClose={() => setModal(null)} title={`OS #${osAtual?.numero_ordem_legado || ''}`} isMobile={vp.isMobile}>
        {osAtual && <OSDetail os={osAtual} onEdit={() => setModal('editar')} isMobile={vp.isMobile} />}
      </Modal>

      <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  )
}

function OSForm({ os, setOs, onSave, onCancel, onDelete, areas, equipamentos, mecanicos, statusList, tiposMan, tiposFalha, isEdit, saving, isMobile }) {
  const upd = (f, v) => setOs({ ...os, [f]: v })
  const grid = isMobile ? '1fr' : '1fr 1fr'
  const canSave = (os.titulo || '').trim()

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '0 16px' }}>
        <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
          <FormField label="Título" required><input style={S.input} value={os.titulo || ''} onChange={e => upd('titulo', e.target.value)} placeholder="Descreva o problema" /></FormField>
        </div>
        <FormField label="Tipo Manutenção"><select style={S.select} value={os.tipo_manutencao_id || ''} onChange={e => upd('tipo_manutencao_id', e.target.value)}>
          <option value="">Selecione...</option>{tiposMan.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select></FormField>
        <FormField label="Tipo Falha"><select style={S.select} value={os.tipo_falha_id || ''} onChange={e => upd('tipo_falha_id', e.target.value)}>
          <option value="">Selecione...</option>{tiposFalha.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select></FormField>
        <FormField label="Área"><select style={S.select} value={os.area_id || ''} onChange={e => upd('area_id', e.target.value)}>
          <option value="">Selecione...</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select></FormField>
        <FormField label="Equipamento"><select style={S.select} value={os.equipamento_id || ''} onChange={e => upd('equipamento_id', e.target.value)}>
          <option value="">Nenhum</option>{equipamentos.map(e => <option key={e.id} value={e.id}>{e.nome} {e.codigo ? `(${e.codigo})` : ''}</option>)}
        </select></FormField>
        <FormField label="Prioridade"><select style={S.select} value={os.prioridade || 'Media'} onChange={e => upd('prioridade', e.target.value)}>
          {Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select></FormField>
        {isEdit && <FormField label="Status"><select style={S.select} value={os.status_id || ''} onChange={e => upd('status_id', e.target.value)}>
          {statusList.map(s => <option key={s.id} value={s.id}>{s.icone} {s.nome}</option>)}
        </select></FormField>}
        <FormField label="Mecânico"><select style={S.select} value={os.mecanico_responsavel_id || ''} onChange={e => upd('mecanico_responsavel_id', e.target.value)}>
          <option value="">Não atribuído</option>{mecanicos.filter(m => m.ativo).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select></FormField>
        <FormField label="Solicitante"><input style={S.input} value={os.solicitante || ''} onChange={e => upd('solicitante', e.target.value)} /></FormField>
      </div>
      <FormField label="Descrição"><textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} value={os.descricao || ''} onChange={e => upd('descricao', e.target.value)} /></FormField>
      <FormField label="Observações"><textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={os.observacoes || ''} onChange={e => upd('observacoes', e.target.value)} /></FormField>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid #1F1F23', gap: 10, flexWrap: 'wrap' }}>
        <div>{onDelete && <button style={S.btnDanger} onClick={onDelete}>Excluir</button>}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button style={{ ...S.btnPrimary, opacity: canSave && !saving ? 1 : 0.4 }} onClick={canSave ? onSave : undefined} disabled={saving}>{saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar OS'}</button>
        </div>
      </div>
    </div>
  )
}

function OSDetail({ os, onEdit, isMobile }) {
  const historico = useOSHistorico(os.id)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatusBadge status={os.status_os} />
        <PrioridadeBadge prioridade={os.prioridade} />
        {os.tipos_manutencao && <span style={badge('#888')}>{os.tipos_manutencao.nome}</span>}
      </div>
      <h2 style={{ margin: '0 0 16px', fontSize: 16, color: '#E5E5E5', lineHeight: 1.4 }}>{os.titulo || 'Sem título'}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px 20px', marginBottom: 16 }}>
        {[
          ['Área', os.areas?.nome], ['Equipamento', os.equipamentos ? `${os.equipamentos.nome} (${os.equipamentos.codigo || os.equipamentos.tag || ''})` : '—'],
          ['Mecânico', os.mecanicos?.nome || 'Não atribuído'], ['Solicitante', os.solicitante],
          ['Executado por', os.executado_por], ['Recebido por', os.recebido_por],
          ['Abertura', fmtDateTime(os.data_abertura)], ['Conclusão', fmtDateTime(os.data_conclusao)],
        ].map(([l, v]) => (
          <div key={l}><div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 3 }}>{l}</div><div style={{ fontSize: 13, color: '#CCC' }}>{v || '—'}</div></div>
        ))}
      </div>
      {os.descricao && <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 6 }}>Descrição</div>
        <div style={{ fontSize: 13, color: '#CCC', lineHeight: 1.6, background: '#1A1A1E', padding: 12, borderRadius: 8 }}>{os.descricao}</div>
      </div>}
      {historico.length > 0 && <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 10 }}>Histórico</div>
        <div style={{ borderLeft: '2px solid #2A2A30', marginLeft: 8, paddingLeft: 16 }}>
          {historico.map((h, i) => (
            <div key={h.id} style={{ marginBottom: 12, position: 'relative' }}>
              <div style={{ position: 'absolute', left: -22, top: 4, width: 8, height: 8, borderRadius: '50%', background: i === 0 ? ACCENT : '#2A2A30' }} />
              <div style={{ fontSize: 11, color: '#666' }}>{fmtDateTime(h.created_at)} — {h.usuario}</div>
              <div style={{ fontSize: 12, color: '#CCC' }}>{h.acao}</div>
            </div>
          ))}
        </div>
      </div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #1F1F23' }}>
        <button style={S.btnPrimary} onClick={onEdit}>✏️ Editar</button>
      </div>
    </div>
  )
}
