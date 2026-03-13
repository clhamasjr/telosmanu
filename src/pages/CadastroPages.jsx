import React, { useState, useMemo } from 'react'
import { useTable, useLookups, useViewport } from '../hooks/useData'
import { S, badge, Modal, FormField, EmptyState, SearchBar, ConfirmDialog, PageHeader, Loading } from '../components/UI'
import { EQUIP_STATUS, TURNOS, UNIDADES, ACCENT } from '../lib/constants'
import { supabase } from '../lib/supabase'

// ══════════════════════════════════════
//  EQUIPAMENTOS
// ══════════════════════════════════════
export function Equipamentos() {
  const { data, loading, insert, update, remove } = useTable('equipamentos', { order: 'nome', ascending: true })
  const { areas } = useLookups()
  const vp = useViewport()
  const [search, setSearch] = useState('')
  const [filtroArea, setFiltroArea] = useState('TODOS')
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const filtered = useMemo(() => data.filter(e => {
    if (filtroArea !== 'TODOS' && e.area_id !== filtroArea) return false
    if (search) { const s = search.toLowerCase(); return (e.nome||'').toLowerCase().includes(s) || (e.codigo||'').toLowerCase().includes(s) || (e.tag||'').toLowerCase().includes(s) }
    return true
  }), [data, search, filtroArea])

  const novo = () => { setItem({ nome: '', codigo: '', tag: '', area_id: '', fabricante: '', modelo: '', status: 'Operando', observacoes: '' }); setModal('novo') }

  const salvar = async () => {
    if (!(item.nome||'').trim()) return
    const payload = { ...item }; delete payload.id; delete payload.created_at; delete payload.updated_at
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
    if (item.id) await update(item.id, payload); else await insert(payload)
    setModal(null)
  }

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader title="EQUIPAMENTOS" action={novo} actionLabel="+ NOVO" isMobile={vp.isMobile} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Nome, código, TAG..." />
        <select style={{ ...S.select, width: 160 }} value={filtroArea} onChange={e => setFiltroArea(e.target.value)}>
          <option value="TODOS">Todas Áreas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? <EmptyState icon="⚙️" message="Nenhum equipamento" action="Cadastrar" onAction={novo} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filtered.map(e => {
            const sc = e.status === 'Operando' ? '#22C55E' : e.status === 'Parado' ? '#EF4444' : '#F59E0B'
            return (
              <div key={e.id} style={{ ...S.card, cursor: 'pointer', borderLeft: '3px solid ' + sc }} onClick={() => { setItem({ ...e }); setModal('editar') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#E5E5E5', fontSize: 14 }}>{e.nome}</span>
                  <span style={badge(sc)}>{e.status}</span>
                </div>
                {e.codigo && <div style={{ fontSize: 12, color: ACCENT, marginBottom: 4 }}>COD: {e.codigo}</div>}
                <div style={{ fontSize: 12, color: '#888' }}>{areas.find(a=>a.id===e.area_id)?.nome || ''}{e.fabricante ? ' · '+e.fabricante : ''}</div>
              </div>
            )
          })}
        </div>
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'NOVO EQUIPAMENTO' : 'EDITAR'} isMobile={vp.isMobile}>
        {item && <div>
          <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? '1fr' : '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Nome" required><input style={S.input} value={item.nome||''} onChange={e => setItem({...item,nome:e.target.value})} /></FormField>
            <FormField label="Código"><input style={S.input} value={item.codigo||''} onChange={e => setItem({...item,codigo:e.target.value})} /></FormField>
            <FormField label="TAG"><input style={S.input} value={item.tag||''} onChange={e => setItem({...item,tag:e.target.value})} /></FormField>
            <FormField label="Área"><select style={S.select} value={item.area_id||''} onChange={e => setItem({...item,area_id:e.target.value})}>
              <option value="">Selecione</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select></FormField>
            <FormField label="Status"><select style={S.select} value={item.status||'Operando'} onChange={e => setItem({...item,status:e.target.value})}>
              {EQUIP_STATUS.map(s => <option key={s}>{s}</option>)}
            </select></FormField>
            <FormField label="Fabricante"><input style={S.input} value={item.fabricante||''} onChange={e => setItem({...item,fabricante:e.target.value})} /></FormField>
            <FormField label="Modelo"><input style={S.input} value={item.modelo||''} onChange={e => setItem({...item,modelo:e.target.value})} /></FormField>
          </div>
          <FormField label="Localização"><input style={S.input} value={item.localizacao||''} onChange={e => setItem({...item,localizacao:e.target.value})} /></FormField>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid #1F1F23', gap: 10, flexWrap: 'wrap' }}>
            {modal==='editar' && <button style={S.btnDanger} onClick={() => setConfirm({message:'Excluir?',onConfirm:async()=>{await remove(item.id);setConfirm(null);setModal(null)}})}>Excluir</button>}
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}><button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button><button style={S.btnPrimary} onClick={salvar}>Salvar</button></div>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  )
}

// ══════════════════════════════════════
//  MECÂNICOS
// ══════════════════════════════════════
export function Mecanicos() {
  const { data, loading, insert, update, remove } = useTable('mecanicos', { order: 'nome', ascending: true })
  const { areas } = useLookups()
  const vp = useViewport()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const filtered = data.filter(m => { if (!search) return true; const s = search.toLowerCase(); return (m.nome||'').toLowerCase().includes(s) || (m.matricula||'').toLowerCase().includes(s) })
  const novo = () => { setItem({ nome: '', matricula: '', especialidade: '', telefone: '', area_id: '', turno: 'A', ativo: true }); setModal('novo') }

  const salvar = async () => {
    if (!(item.nome||'').trim()) return
    const payload = { ...item }; delete payload.id; delete payload.created_at; delete payload.updated_at
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
    if (item.id) await update(item.id, payload); else await insert(payload)
    setModal(null)
  }

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader title="MECÂNICOS" action={novo} actionLabel="+ NOVO" isMobile={vp.isMobile} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Nome, matrícula..." />
        <span style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap' }}>{filtered.filter(m => m.ativo).length} ativo(s)</span>
      </div>
      {filtered.length === 0 ? <EmptyState icon="👨‍🔧" message="Nenhum mecânico" action="Cadastrar" onAction={novo} /> : (
        vp.isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(m => (
              <div key={m.id} style={S.card} onClick={() => { setItem({...m}); setModal('editar') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{m.nome}</span>
                  <span style={badge(m.ativo ? '#22C55E' : '#EF4444')}>{m.ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>Mat: <strong style={{ color: ACCENT }}>{m.matricula||'—'}</strong> · {m.especialidade||'—'} · Turno {m.turno||'—'}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={S.th}>Matrícula</th><th style={S.th}>Nome</th><th style={S.th}>Especialidade</th><th style={S.th}>Turno</th><th style={S.th}>Status</th><th style={S.th}></th></tr></thead>
              <tbody>{filtered.map(m => (
                <tr key={m.id}><td style={{ ...S.td, color: ACCENT, fontWeight: 700 }}>{m.matricula||'—'}</td><td style={S.td}>{m.nome}</td>
                <td style={{ ...S.td, color: '#999' }}>{m.especialidade||'—'}</td><td style={S.td}><span style={badge('#3B82F6')}>Turno {m.turno||'—'}</span></td>
                <td style={S.td}><span style={badge(m.ativo?'#22C55E':'#EF4444')}>{m.ativo?'Ativo':'Inativo'}</span></td>
                <td style={S.td}><button style={{...S.btnSecondary,padding:'6px 10px',minHeight:36}} onClick={()=>{setItem({...m});setModal('editar')}}>✏️</button></td></tr>
              ))}</tbody></table></div>
        )
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal==='novo'?'NOVO MECÂNICO':'EDITAR'} isMobile={vp.isMobile}>
        {item && <div>
          <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? '1fr' : '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Nome" required><input style={S.input} value={item.nome||''} onChange={e=>setItem({...item,nome:e.target.value})} /></FormField>
            <FormField label="Matrícula"><input style={S.input} value={item.matricula||''} onChange={e=>setItem({...item,matricula:e.target.value})} /></FormField>
            <FormField label="Especialidade"><input style={S.input} value={item.especialidade||''} onChange={e=>setItem({...item,especialidade:e.target.value})} placeholder="Elétrica, Mecânica..." /></FormField>
            <FormField label="Telefone"><input style={S.input} value={item.telefone||''} onChange={e=>setItem({...item,telefone:e.target.value})} /></FormField>
            <FormField label="Área"><select style={S.select} value={item.area_id||''} onChange={e=>setItem({...item,area_id:e.target.value})}><option value="">Selecione</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></FormField>
            <FormField label="Turno"><select style={S.select} value={item.turno||'A'} onChange={e=>setItem({...item,turno:e.target.value})}>{TURNOS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></FormField>
          </div>
          <FormField label="Status"><label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',minHeight:44}}><input type="checkbox" checked={item.ativo!==false} onChange={e=>setItem({...item,ativo:e.target.checked})} style={{width:20,height:20}}/><span style={{fontSize:14,color:item.ativo!==false?'#22C55E':'#EF4444'}}>{item.ativo!==false?'Ativo':'Inativo'}</span></label></FormField>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:20,paddingTop:16,borderTop:'1px solid #1F1F23',gap:10,flexWrap:'wrap'}}>
            {modal==='editar'&&<button style={S.btnDanger} onClick={()=>setConfirm({message:'Excluir?',onConfirm:async()=>{await remove(item.id);setConfirm(null);setModal(null)}})}>Excluir</button>}
            <div style={{display:'flex',gap:10,marginLeft:'auto'}}><button style={S.btnSecondary} onClick={()=>setModal(null)}>Cancelar</button><button style={S.btnPrimary} onClick={salvar}>Salvar</button></div>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={()=>setConfirm(null)} />
    </div>
  )
}

// ══════════════════════════════════════
//  ESTOQUE DE PEÇAS
// ══════════════════════════════════════
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

  const filtered = data.filter(p => {
    if (filtro === 'BAIXO' && p.quantidade > p.estoque_minimo) return false
    if (filtro === 'ZERADO' && p.quantidade > 0) return false
    if (search) { const s = search.toLowerCase(); return (p.nome||'').toLowerCase().includes(s) || (p.codigo||'').toLowerCase().includes(s) }
    return true
  })

  const nova = () => { setItem({ nome: '', codigo: '', categoria: '', unidade: 'UN', quantidade: 0, estoque_minimo: 5, localizacao: '', fornecedor_id: '' }); setModal('novo') }

  const salvar = async () => {
    if (!(item.nome||'').trim()) return
    const payload = { ...item }; delete payload.id; delete payload.created_at; delete payload.updated_at
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
    if (item.id) await update(item.id, payload); else await insert(payload)
    setModal(null)
  }

  const registrarMov = async (tipo) => {
    if (movQtd <= 0) return
    const p = data.find(x => x.id === movModal)
    if (!p) return
    const nq = tipo === 'entrada' ? p.quantidade + movQtd : Math.max(0, p.quantidade - movQtd)
    await supabase.from('movimentacao_estoque').insert({
      material_id: p.id, tipo, quantidade: movQtd, observacoes: movObs || null, usuario: 'Operador',
    })
    await update(p.id, { quantidade: nq })
    setMovModal(null); setMovQtd(1); setMovObs('')
  }

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader title="ESTOQUE DE PEÇAS" action={nova} actionLabel="+ NOVA" isMobile={vp.isMobile} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Nome, código..." />
        <select style={{ ...S.select, width: 180 }} value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="TODOS">Todos</option><option value="BAIXO">⚠️ Estoque Baixo</option><option value="ZERADO">🔴 Zerado</option>
        </select>
      </div>
      {filtered.length === 0 ? <EmptyState icon="📦" message="Nenhuma peça" action="Cadastrar" onAction={nova} /> : (
        vp.isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(p => {
              const low = p.quantidade <= p.estoque_minimo, zero = p.quantidade === 0
              return (
                <div key={p.id} style={{ ...S.card, borderLeft: '3px solid ' + (zero ? '#EF4444' : low ? '#F59E0B' : '#22C55E') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: '#E5E5E5', fontSize: 14 }}>{p.nome}</span>
                    {zero ? <span style={badge('#EF4444')}>ZERADO</span> : low ? <span style={badge('#F59E0B')}>BAIXO</span> : <span style={badge('#22C55E')}>OK</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Cód: <strong style={{ color: ACCENT }}>{p.codigo||'—'}</strong> · Qtd: <strong>{p.quantidade}</strong>/{p.estoque_minimo} {p.unidade}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...S.btnSecondary, flex: 1, fontSize: 12 }} onClick={() => { setMovModal(p.id); setMovQtd(1); setMovObs('') }}>📦 Movimentar</button>
                    <button style={{ ...S.btnSecondary, fontSize: 12 }} onClick={() => { setItem({ ...p }); setModal('editar') }}>✏️</button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={S.th}>Código</th><th style={S.th}>Nome</th><th style={S.th}>Qtd</th><th style={S.th}>Mín</th><th style={S.th}>Status</th><th style={S.th}>Ações</th></tr></thead>
              <tbody>{filtered.map(p => {
                const low = p.quantidade <= p.estoque_minimo, zero = p.quantidade === 0
                return (
                  <tr key={p.id}><td style={{ ...S.td, color: ACCENT, fontWeight: 700 }}>{p.codigo||'—'}</td><td style={S.td}>{p.nome}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: zero ? '#EF4444' : low ? '#F59E0B' : '#22C55E' }}>{p.quantidade}</td>
                  <td style={{ ...S.td, color: '#666' }}>{p.estoque_minimo}</td>
                  <td style={S.td}>{zero ? <span style={badge('#EF4444')}>ZERADO</span> : low ? <span style={badge('#F59E0B')}>BAIXO</span> : <span style={badge('#22C55E')}>OK</span>}</td>
                  <td style={S.td}><div style={{ display: 'flex', gap: 4 }}>
                    <button style={{...S.btnSecondary,padding:'6px 8px',minHeight:36,fontSize:12}} onClick={()=>{setMovModal(p.id);setMovQtd(1);setMovObs('')}}>📦</button>
                    <button style={{...S.btnSecondary,padding:'6px 8px',minHeight:36,fontSize:12}} onClick={()=>{setItem({...p});setModal('editar')}}>✏️</button>
                  </div></td></tr>
                )
              })}</tbody></table></div>
        )
      )}
      <Modal open={modal==='novo'||modal==='editar'} onClose={()=>setModal(null)} title={modal==='novo'?'NOVA PEÇA':'EDITAR'} isMobile={vp.isMobile}>
        {item && <div>
          <div style={{display:'grid',gridTemplateColumns:vp.isMobile?'1fr':'1fr 1fr',gap:'0 16px'}}>
            <FormField label="Código"><input style={S.input} value={item.codigo||''} onChange={e=>setItem({...item,codigo:e.target.value})} /></FormField>
            <FormField label="Nome" required><input style={S.input} value={item.nome||''} onChange={e=>setItem({...item,nome:e.target.value})} /></FormField>
            <FormField label="Categoria"><input style={S.input} value={item.categoria||''} onChange={e=>setItem({...item,categoria:e.target.value})} /></FormField>
            <FormField label="Unidade"><select style={S.select} value={item.unidade||'UN'} onChange={e=>setItem({...item,unidade:e.target.value})}>{UNIDADES.map(u=><option key={u}>{u}</option>)}</select></FormField>
            <FormField label="Qtd Atual"><input style={S.input} type="number" min="0" value={item.quantidade||0} onChange={e=>setItem({...item,quantidade:parseFloat(e.target.value)||0})} /></FormField>
            <FormField label="Estoque Mín"><input style={S.input} type="number" min="0" value={item.estoque_minimo||0} onChange={e=>setItem({...item,estoque_minimo:parseFloat(e.target.value)||0})} /></FormField>
            <FormField label="Localização"><input style={S.input} value={item.localizacao||''} onChange={e=>setItem({...item,localizacao:e.target.value})} /></FormField>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:20,paddingTop:16,borderTop:'1px solid #1F1F23',gap:10,flexWrap:'wrap'}}>
            {modal==='editar'&&<button style={S.btnDanger} onClick={()=>setConfirm({message:'Excluir?',onConfirm:async()=>{await remove(item.id);setConfirm(null);setModal(null)}})}>Excluir</button>}
            <div style={{display:'flex',gap:10,marginLeft:'auto'}}><button style={S.btnSecondary} onClick={()=>setModal(null)}>Cancelar</button><button style={S.btnPrimary} onClick={salvar}>Salvar</button></div>
          </div>
        </div>}
      </Modal>
      <Modal open={!!movModal} onClose={()=>setMovModal(null)} title="MOVIMENTAÇÃO" isMobile={vp.isMobile}>
        {movModal && (() => { const p = data.find(x=>x.id===movModal); if(!p) return null; return (
          <div>
            <div style={{background:'#1A1A1E',padding:14,borderRadius:8,marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:700}}>{p.nome}</div>
              <div style={{fontSize:13,color:'#888'}}>Estoque: <strong style={{color:ACCENT}}>{p.quantidade} {p.unidade}</strong></div>
            </div>
            <FormField label="Quantidade"><input style={S.input} type="number" min="1" value={movQtd} onChange={e=>setMovQtd(parseInt(e.target.value)||0)} /></FormField>
            <FormField label="Observação"><input style={S.input} value={movObs} onChange={e=>setMovObs(e.target.value)} placeholder="OS vinculada..." /></FormField>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button style={{...S.btnPrimary,flex:1,background:'#22C55E'}} onClick={()=>registrarMov('entrada')}>↓ ENTRADA</button>
              <button style={{...S.btnPrimary,flex:1,background:'#EF4444'}} onClick={()=>registrarMov('saida')}>↑ SAÍDA</button>
            </div>
          </div>
        )})()}
      </Modal>
      <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={()=>setConfirm(null)} />
    </div>
  )
}

// ══════════════════════════════════════
//  ÁREAS & SETORES
// ══════════════════════════════════════
export function Areas() {
  const { data, loading, insert, update, remove } = useTable('areas', { order: 'nome', ascending: true })
  const vp = useViewport()
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const nova = () => { setItem({ nome: '', descricao: '', responsavel: '' }); setModal('novo') }
  const salvar = async () => {
    if (!(item.nome||'').trim()) return
    const payload = { nome: item.nome, descricao: item.descricao || null, responsavel: item.responsavel || null }
    if (item.id) await update(item.id, payload); else await insert(payload)
    setModal(null)
  }

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader title="ÁREAS & SETORES" action={nova} actionLabel="+ NOVA" isMobile={vp.isMobile} />
      <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {data.map(a => (
          <div key={a.id} style={{ ...S.card, cursor: 'pointer' }} onClick={() => { setItem({ ...a }); setModal('editar') }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, letterSpacing: 1, color: ACCENT, marginBottom: 4 }}>{a.nome}</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{a.descricao || 'Sem descrição'}</div>
            {a.responsavel && <div style={{ fontSize: 11, color: '#666' }}>Resp.: {a.responsavel}</div>}
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'NOVA ÁREA' : 'EDITAR'} isMobile={vp.isMobile}>
        {item && <div>
          <FormField label="Nome" required><input style={S.input} value={item.nome||''} onChange={e => setItem({ ...item, nome: e.target.value })} /></FormField>
          <FormField label="Descrição"><textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={item.descricao||''} onChange={e => setItem({ ...item, descricao: e.target.value })} /></FormField>
          <FormField label="Responsável"><input style={S.input} value={item.responsavel||''} onChange={e => setItem({ ...item, responsavel: e.target.value })} /></FormField>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid #1F1F23', gap: 10, flexWrap: 'wrap' }}>
            {modal === 'editar' && <button style={S.btnDanger} onClick={() => setConfirm({ message: 'Excluir?', onConfirm: async () => { await remove(item.id); setConfirm(null); setModal(null) } })}>Excluir</button>}
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}><button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button><button style={S.btnPrimary} onClick={salvar}>Salvar</button></div>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  )
}
