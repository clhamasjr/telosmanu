import React, { useState, useEffect, useMemo } from 'react'
import { useTable, useLookups, useViewport } from '../hooks/useData'
import { S, badge, Modal, Field, Empty, Search, Header, Loading, KPI, fmtDate, fmtHrs } from '../components/UI'
import { PERIODICIDADES, PERFIS, PERFIS_CONFIG, getPerfil, getPermissao, ACCENT, FONT_DISPLAY, FONT } from '../lib/constants'
import { supabase } from '../lib/supabase'

// ══════════════════════════════════════════════════════
//  RELATÓRIOS & INDICADORES DE MANUTENÇÃO
// ══════════════════════════════════════════════════════
export function Relatorios() {
  const vp = useViewport()
  const hoje = new Date()
  const mesAtualFrom = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`
  const mesAtualTo = hoje.toISOString().split('T')[0]
  
  const [periodoInput, setPeriodoInput] = useState({ from: mesAtualFrom, to: mesAtualTo })
  const [periodoAtivo, setPeriodoAtivo] = useState({ from: mesAtualFrom, to: mesAtualTo })
  const [presetAtivo, setPresetAtivo] = useState('mes')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('kpis')

  const aplicarPreset = (tipo) => {
    const d = new Date()
    let from, to
    if (tipo === 'mes') {
      from = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
      to = d.toISOString().split('T')[0]
    } else if (tipo === 'anterior') {
      d.setMonth(d.getMonth()-1)
      const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0')
      from = `${y}-${m}-01`
      to = `${y}-${m}-${new Date(y, d.getMonth()+1, 0).getDate()}`
    } else if (tipo === 'trimestre') {
      d.setMonth(d.getMonth()-3)
      from = d.toISOString().split('T')[0]
      to = new Date().toISOString().split('T')[0]
    } else if (tipo === 'ano') {
      from = `${d.getFullYear()}-01-01`
      to = d.toISOString().split('T')[0]
    } else if (tipo === 'tudo') {
      from = '2020-01-01'; to = d.toISOString().split('T')[0]
    }
    setPresetAtivo(tipo)
    setPeriodoInput({ from, to })
    setPeriodoAtivo({ from, to })
  }

  const pesquisar = () => {
    setPresetAtivo('custom')
    setPeriodoAtivo({ ...periodoInput })
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { from, to } = periodoAtivo
      let allOS = [], pg = 0
      while (true) {
        const { data: rows } = await supabase.from('ordens_servico')
          .select('id,numero_ordem,titulo,data_abertura,data_inicio,data_conclusao,tempo_execucao_min,tempo_maquina_parada_min,tempo_atendimento_min,executado_por,solicitante,equipamento_id,equipamentos(id,nome,codigo),areas(nome),status_os(nome),tipos_manutencao(nome),tipos_falha(nome)')
          .gte('data_abertura', from + 'T00:00:00').lte('data_abertura', to + 'T23:59:59')
          .order('data_abertura').range(pg * 1000, (pg + 1) * 1000 - 1)
        if (!rows || rows.length === 0) break
        allOS = allOS.concat(rows)
        if (rows.length < 1000) break
        pg++; if (pg > 30) break
      }
      const { data: mecs } = await supabase.from('mecanicos').select('*').eq('ativo', true)

      // ── MTTR: tempo médio de reparo (conclusão - início) ──
      const repairTimes = allOS.filter(o => o.data_inicio && o.data_conclusao)
        .map(o => (new Date(o.data_conclusao) - new Date(o.data_inicio)) / 3600000)
        .filter(t => t > 0 && t < 5000)
      const mttr = repairTimes.length > 0 ? repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length : 0

      // ── MTBF: tempo médio entre falhas por equipamento ──
      const eqFails = {}
      allOS.filter(o => o.data_abertura && o.equipamentos?.id).forEach(o => {
        if (!eqFails[o.equipamentos.id]) eqFails[o.equipamentos.id] = { nome: o.equipamentos.nome, codigo: o.equipamentos.codigo, dates: [] }
        eqFails[o.equipamentos.id].dates.push(new Date(o.data_abertura))
      })
      const gaps = []
      Object.values(eqFails).forEach(eq => {
        eq.dates.sort((a, b) => a - b)
        for (let i = 1; i < eq.dates.length; i++) { const g = (eq.dates[i] - eq.dates[i - 1]) / 3600000; if (g > 0 && g < 50000) gaps.push(g) }
      })
      const mtbf = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0

      // ── Tempo médio de atendimento (abertura → início) ──
      const attTimes = allOS.filter(o => o.tempo_atendimento_min > 0).map(o => o.tempo_atendimento_min)
      const mtAtt = attTimes.length > 0 ? attTimes.reduce((a, b) => a + b, 0) / attTimes.length : 0

      // ── Disponibilidade = média por equipamento ──
      const diasPeriodo = Math.max(1, (new Date(to) - new Date(from)) / 86400000)
      const diasUteis = Math.round(diasPeriodo * 5 / 7)
      const horasDisp = diasUteis * 8
      const horasTotaisEquip = diasPeriodo * 24
      // Calcular por equipamento e fazer média
      const eqRepairMap = {}
      allOS.filter(o => o.data_inicio && o.data_conclusao && o.equipamentos?.id).forEach(o => {
        const hrs = (new Date(o.data_conclusao) - new Date(o.data_inicio)) / 3600000
        if (hrs > 0 && hrs < 5000) {
          if (!eqRepairMap[o.equipamentos.id]) eqRepairMap[o.equipamentos.id] = 0
          eqRepairMap[o.equipamentos.id] += hrs
        }
      })
      const eqDisps = Object.values(eqRepairMap).map(hrs => {
        return Math.max(0, Math.min(100, ((horasTotaisEquip - hrs) / horasTotaisEquip) * 100))
      })
      const disponibilidade = eqDisps.length > 0 ? eqDisps.reduce((a, b) => a + b, 0) / eqDisps.length : 100
      
      // ── Buscar apontamentos HH do período ──
      let allHH = [], hhPg = 0
      while (true) {
        const { data: hhRows } = await supabase.from('apontamento_hh')
          .select('ordem_servico_id,mecanico_id,tempo_minutos,mecanicos(nome)')
          .gte('data_inicio', from + 'T00:00:00').lte('data_inicio', to + 'T23:59:59')
          .range(hhPg * 1000, (hhPg + 1) * 1000 - 1)
        if (!hhRows || hhRows.length === 0) break
        allHH = allHH.concat(hhRows)
        if (hhRows.length < 1000) break
        hhPg++; if (hhPg > 30) break
      }

      // ── Montar mapa de mecânicos com HH real ──
      const mecMap = {}
      allHH.forEach(h => {
        const nome = h.mecanicos?.nome || 'Não identificado'
        const minutos = Math.max(0, h.tempo_minutos || 0)
        if (!mecMap[nome]) mecMap[nome] = { total: 0, tempoTotal: 0, osIds: new Set() }
        mecMap[nome].tempoTotal += minutos
        if (h.ordem_servico_id && !mecMap[nome].osIds.has(h.ordem_servico_id)) {
          mecMap[nome].osIds.add(h.ordem_servico_id)
          mecMap[nome].total++
        }
      })
      // Fallback: executado_por das OS (dados SOFMAN sem apontamento HH)
      allOS.forEach(o => {
        const exec = o.executado_por
        if (!exec) return
        if (!mecMap[exec]) mecMap[exec] = { total: 0, tempoTotal: 0, osIds: new Set() }
        if (!mecMap[exec].osIds.has(o.id)) {
          mecMap[exec].osIds.add(o.id)
          mecMap[exec].total++
        }
      })
      // Mecânicos cadastrados sem OS no período (mostrar com 0)
      ;(mecs || []).forEach(m => {
        if (!mecMap[m.nome]) mecMap[m.nome] = { total: 0, tempoTotal: 0, osIds: new Set() }
      })
      const osPorMec = Object.entries(mecMap).map(([nome, v]) => ({
        nome, total: v.total, tempoTotal: v.tempoTotal, tempoMedio: v.total > 0 ? v.tempoTotal / v.total : 0,
      })).sort((a, b) => b.total - a.total)

      // ── HH consolidado ──
      const hhPorMec = osPorMec.map(m => ({
        nome: m.nome, horas: m.tempoTotal / 60, registros: m.total,
      })).sort((a, b) => b.horas - a.horas)

      // ── Top equipamentos que mais param ──
      // Somar HH dos apontamentos por OS → por equipamento
      const hhPorOS = {}
      allHH.forEach(h => {
        if (!h.ordem_servico_id) return
        hhPorOS[h.ordem_servico_id] = (hhPorOS[h.ordem_servico_id] || 0) + Math.max(0, h.tempo_minutos || 0)
      })
      const eqParadas = {}
      allOS.forEach(o => {
        const eqNome = o.equipamentos?.nome || 'Sem equipamento'
        const eqId = o.equipamentos?.id
        if (!eqId) return
        if (!eqParadas[eqId]) eqParadas[eqId] = { nome: eqNome, codigo: o.equipamentos?.codigo, total: 0, tempoParada: 0, tempoReparo: 0, falhas: {} }
        eqParadas[eqId].total++
        eqParadas[eqId].tempoParada += o.tempo_maquina_parada_min || 0
        eqParadas[eqId].tempoReparo += hhPorOS[o.id] || 0
        const falha = o.tipos_falha?.nome || o.tipos_manutencao?.nome || '?'
        eqParadas[eqId].falhas[falha] = (eqParadas[eqId].falhas[falha] || 0) + 1
      })
      const topEquip = Object.values(eqParadas).sort((a, b) => b.total - a.total)

      // ── OS por tipo falha (use tipo_manutencao as fallback) ──
      const falhaMap = {}
      allOS.forEach(o => { 
        const f = o.tipos_falha?.nome || o.tipos_manutencao?.nome || 'Não classificada'
        falhaMap[f] = (falhaMap[f] || 0) + 1 
      })

      // ── OS por tipo manutenção ──
      const tipoMap = {}
      allOS.forEach(o => { const t = o.tipos_manutencao?.nome || '?'; tipoMap[t] = (tipoMap[t] || 0) + 1 })

      // ── OS por área ──
      const areaMap = {}
      allOS.forEach(o => { const a = o.areas?.nome || 'Sem área'; areaMap[a] = (areaMap[a] || 0) + 1 })

      // ── Sugestões de preventiva ──
      // Equipamentos com > 10 OS corretivas → sugerir preventiva
      const sugestoes = topEquip.filter(e => e.total >= 5).map(e => {
        const topFalha = Object.entries(e.falhas).sort((a, b) => b[1] - a[1])[0]
        const mtbfEq = eqFails[Object.keys(eqParadas).find(k => eqParadas[k].nome === e.nome)]
        let intervalo = 'Mensal'
        if (e.total > 100) intervalo = 'Semanal'
        else if (e.total > 50) intervalo = 'Quinzenal'
        else if (e.total > 20) intervalo = 'Mensal'
        else intervalo = 'Trimestral'
        return {
          equipamento: e.nome, codigo: e.codigo, totalOS: e.total,
          principalFalha: topFalha ? topFalha[0] : '?', qtdPrincipal: topFalha ? topFalha[1] : 0,
          tempoMedio: e.total > 0 ? Math.round((e.tempoParada || e.tempoReparo) / e.total) : 0,
          sugestaoPeriodicidade: intervalo,
          sugestaoDescricao: `Inspeção preventiva ${topFalha ? topFalha[0].toLowerCase() : ''} - ${e.nome}`,
        }
      })

      setData({
        records: allOS, mttr, mtbf, mtAtt, disponibilidade,
        totalOS: allOS.length,
        totalConcluidas: allOS.filter(o => o.status_os?.nome === 'Concluída').length,
        totalAbertas: allOS.filter(o => o.status_os?.nome === 'Aberta').length,
        osPorMec, hhPorMec, topEquip, sugestoes,
        falhaMap: Object.entries(falhaMap).sort((a, b) => b[1] - a[1]),
        tipoMap: Object.entries(tipoMap).sort((a, b) => b[1] - a[1]),
        areaMap: Object.entries(areaMap).sort((a, b) => b[1] - a[1]),
        mecanicos: mecs || [], horasDisponiveis: horasDisp,
      })
      setLoading(false)
    })()
  }, [periodoAtivo.from, periodoAtivo.to])

  if (loading || !data) return <Loading />
  const d = data
  const Bar = ({ items, color }) => items.length === 0 ? <div style={{ color: '#94A3B8', textAlign: 'center', padding: 12, fontSize: 11 }}>Sem dados</div> :
    items.slice(0, 10).map(([label, count]) => { const mx = Math.max(...items.map(x => x[1])); return <div key={label} style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}><span style={{ color: '#334155' }}>{label}</span><span style={{ color, fontWeight: 700 }}>{count}</span></div>
      <div style={{ background: '#F1F5F9', borderRadius: 3, height: 5 }}><div style={{ background: color, height: '100%', borderRadius: 3, width: `${(count / mx) * 100}%` }} /></div>
    </div> })

  const tabs = [
    { key: 'kpis', label: '📊 KPIs', short: 'KPIs' },
    { key: 'equipamentos', label: '⚙️ Equipamentos', short: 'Equip' },
    { key: 'mecanicos', label: '👨‍🔧 Mecânicos', short: 'Mec' },
    { key: 'sugestoes', label: '💡 Sugestões', short: 'Prev' },
  ]

  return <div>
    <h1 style={{ margin: '0 0 16px', fontFamily: FONT_DISPLAY, fontSize: vp.isMobile ? 22 : 30, letterSpacing: 2, color: ACCENT }}>RELATÓRIOS & INDICADORES</h1>

    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <Field label="Período de"><input style={{ ...S.input, width: 150 }} type="date" value={periodoInput.from} onChange={e => setPeriodoInput(p=>({...p, from: e.target.value}))} /></Field>
      <Field label="Até"><input style={{ ...S.input, width: 150 }} type="date" value={periodoInput.to} onChange={e => setPeriodoInput(p=>({...p, to: e.target.value}))} /></Field>
      <button style={{...S.btnP, padding:'10px 18px', marginBottom:16}} onClick={pesquisar}>🔍 Pesquisar</button>
    </div>
    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
      {[['mes','Mês Atual'],['anterior','Mês Anterior'],['trimestre','Trimestre'],['ano','Ano'],['tudo','Tudo']].map(([k,l])=>
        <button key={k} onClick={()=>aplicarPreset(k)} style={{
          ...S.btnS, padding:'6px 12px', minHeight:30, fontSize:10, fontWeight:600,
          background:presetAtivo===k?ACCENT+'22':'transparent', color:presetAtivo===k?ACCENT:'#64748B',
          borderColor:presetAtivo===k?ACCENT:'#CBD5E1',
        }}>{l}</button>
      )}
      <span style={{ fontSize: 11, color: '#94A3B8', display:'flex', alignItems:'center', marginLeft:8 }}>{d.totalOS.toLocaleString()} OS no período</span>
    </div>

    {/* Tabs */}
    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
      {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        ...S.btnS, padding: '8px 14px', minHeight: 36, fontSize: 11, fontWeight: 600,
        background: tab === t.key ? ACCENT + '20' : 'transparent', color: tab === t.key ? ACCENT : '#64748B',
        borderColor: tab === t.key ? ACCENT : '#CBD5E1',
      }}>{vp.isMobile ? t.short : t.label}</button>)}
    </div>

    {/* ── TAB: KPIs GERAIS ── */}
    {tab === 'kpis' && <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPI label="MTTR" value={`${d.mttr.toFixed(1)}h`} accent="#3B82F6" sub="Tempo Médio de Reparo" small={vp.isMobile} />
        <KPI label="MTBF" value={`${d.mtbf.toFixed(0)}h`} accent="#22C55E" sub="Tempo Médio Entre Falhas" small={vp.isMobile} />
        <KPI label="T. Atendimento" value={`${d.mtAtt.toFixed(0)}min`} accent="#F59E0B" sub="Abertura → Início" small={vp.isMobile} />
        <KPI label="Disponibilidade" value={`${d.disponibilidade.toFixed(1)}%`} accent={d.disponibilidade > 90 ? '#22C55E' : '#EF4444'} sub="Uptime" small={vp.isMobile} />
        <KPI label="Total OS" value={d.totalOS.toLocaleString()} accent="#64748B" sub={`${d.totalConcluidas} concluídas`} small={vp.isMobile} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        <div style={S.card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>🔧 OS por Tipo de Falha</h3>
          <Bar items={d.falhaMap} color={ACCENT} />
        </div>
        <div style={S.card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>📋 OS por Tipo de Manutenção</h3>
          <Bar items={d.tipoMap} color="#3B82F6" />
        </div>
        <div style={S.card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>🏭 OS por Área</h3>
          <Bar items={d.areaMap} color="#22C55E" />
        </div>
        <div style={S.card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>⏱️ Controle de Horas Mecânicos</h3>
          {d.osPorMec.length === 0 ? <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: 16 }}>Nenhum mecânico cadastrado</div> :
          d.osPorMec.slice(0, 15).map(m => {
            const hrs = m.tempoTotal / 60
            const pct = d.horasDisponiveis > 0 ? Math.min(100, (hrs / d.horasDisponiveis) * 100) : 0
            const cor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#22C55E'
            return <div key={m.nome} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: '#334155', fontWeight: 600 }}>{m.nome} <span style={{ color: '#94A3B8', fontWeight: 400 }}>({m.total} OS)</span></span>
                <span style={{ color: cor, fontWeight: 700 }}>{hrs.toFixed(0)}h / {d.horasDisponiveis}h ({pct.toFixed(0)}%)</span>
              </div>
              <div style={{ background: '#F1F5F9', borderRadius: 3, height: 6 }}><div style={{ background: cor, height: '100%', borderRadius: 3, width: `${Math.max(pct, 1)}%` }} /></div>
            </div>
          })}
        </div>
      </div>
    </>}

    {/* ── TAB: EQUIPAMENTOS ── */}
    {tab === 'equipamentos' && <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <KPI label="Equip c/ OS" value={d.topEquip.length} accent={ACCENT} sub="No período" small={vp.isMobile} />
        <KPI label="Top Paradas" value={d.topEquip[0]?.total || 0} accent="#EF4444" sub={d.topEquip[0]?.nome || '—'} small={vp.isMobile} />
        <KPI label="Parada Total" value={fmtHrs(d.topEquip.reduce((s, e) => s + e.tempoParada, 0))} accent="#F59E0B" sub="Máquina parada" small={vp.isMobile} />
        <KPI label="HH Reparo" value={fmtHrs(d.topEquip.reduce((s, e) => s + e.tempoReparo, 0))} accent="#3B82F6" sub="Horas de reparo" small={vp.isMobile} />
      </div>
      <div style={S.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>🏆 Ranking de Paradas por Equipamento</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={S.th}>#</th><th style={S.th}>Equipamento</th><th style={S.th}>Cód.</th><th style={S.th}>OS</th><th style={S.th}>Parada</th><th style={S.th}>HH Reparo</th><th style={S.th}>T. Médio</th><th style={S.th}>Principal Falha</th>
            </tr></thead>
            <tbody>{d.topEquip.slice(0, 30).map((e, i) => {
              const topF = Object.entries(e.falhas).sort((a, b) => b[1] - a[1])[0]
              return <tr key={i}>
                <td style={{ ...S.td, color: i < 3 ? '#EF4444' : '#64748B', fontWeight: 700 }}>{i + 1}º</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{e.nome}</td>
                <td style={{ ...S.td, color: ACCENT, fontSize: 11 }}>{e.codigo || '—'}</td>
                <td style={{ ...S.td, fontWeight: 700, color: e.total > 50 ? '#EF4444' : e.total > 20 ? '#F59E0B' : '#0F172A' }}>{e.total}</td>
                <td style={{ ...S.td, fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>{fmtHrs(e.tempoParada)}</td>
                <td style={{ ...S.td, fontSize: 11, color: '#3B82F6', fontWeight: 600 }}>{fmtHrs(e.tempoReparo)}</td>
                <td style={{ ...S.td, fontSize: 11, color: '#64748B' }}>{e.total > 0 ? Math.round((e.tempoParada || e.tempoReparo) / e.total) : 0}min</td>
                <td style={{ ...S.td, fontSize: 11 }}>{topF ? <span>{topF[0]} <span style={{ color: '#94A3B8' }}>({topF[1]}x)</span></span> : '—'}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </div>
    </>}

    {/* ── TAB: MECÂNICOS ── */}
    {tab === 'mecanicos' && <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <KPI label="Mecânicos Ativos" value={d.osPorMec.length} accent={ACCENT} sub="Com OS no período" small={vp.isMobile} />
        <KPI label="Total HH" value={`${(d.osPorMec.reduce((s, m) => s + m.tempoTotal, 0) / 60).toFixed(0)}h`} accent="#3B82F6" sub="Horas trabalhadas" small={vp.isMobile} />
        <KPI label="Horas Disp." value={`${d.horasDisponiveis}h`} accent="#A855F7" sub="Por mecânico no período" small={vp.isMobile} />
      </div>
      <div style={S.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>👨‍🔧 Hora-Homem por Mecânico</h3>
        {d.osPorMec.length === 0 ? <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: 20 }}>Nenhum mecânico cadastrado</div> :
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={S.th}>Mecânico</th><th style={S.th}>OS Atendidas</th><th style={S.th}>Horas Totais</th><th style={S.th}>T. Médio/OS</th><th style={S.th}>Ocupação</th>
            </tr></thead>
            <tbody>{d.osPorMec.slice(0, 30).map(m => {
              const hrs = m.tempoTotal / 60
              const pct = d.horasDisponiveis > 0 ? Math.min(100, hrs / d.horasDisponiveis * 100) : 0
              const cor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#22C55E'
              return <tr key={m.nome}>
                <td style={{ ...S.td, fontWeight: 600 }}>{m.nome}</td>
                <td style={{ ...S.td, fontWeight: 700, color: ACCENT }}>{m.total}</td>
                <td style={{ ...S.td, color: '#3B82F6', fontWeight: 700 }}>{hrs.toFixed(1)}h</td>
                <td style={{ ...S.td, fontSize: 11, color: '#64748B' }}>{m.tempoMedio.toFixed(0)}min</td>
                <td style={S.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ background: '#F1F5F9', borderRadius: 3, height: 6, flex: 1 }}><div style={{ background: cor, height: '100%', borderRadius: 3, width: `${Math.max(pct, 1)}%` }} /></div>
                    <span style={{ fontSize: 10, color: cor, fontWeight: 700, minWidth: 35 }}>{pct.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            })}</tbody>
          </table>
        </div>}
      </div>
    </>}

    {/* ── TAB: SUGESTÕES PREVENTIVA ── */}
    {tab === 'sugestoes' && <>
      <div style={{ ...S.card, borderLeft: '3px solid #F59E0B', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, color: '#F59E0B', fontWeight: 700 }}>💡 Análise para Plano de Manutenção Preventiva</h3>
        <p style={{ fontSize: 12, color: '#334155', lineHeight: 1.6, margin: 0 }}>
          Baseado no histórico de {d.totalOS.toLocaleString()} OS, identificamos {d.sugestoes.length} equipamentos que se beneficiariam de manutenção preventiva.
          A análise considera: frequência de paradas, tipo de falha recorrente e tempo médio de reparo.
        </p>
      </div>

      {d.sugestoes.length === 0 ? <Empty icon="💡" msg="Sem sugestões no período selecionado" /> :
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={S.th}>Equipamento</th><th style={S.th}>OS no Período</th><th style={S.th}>Falha Principal</th><th style={S.th}>T. Médio Reparo</th><th style={S.th}>Periodicidade Sugerida</th><th style={S.th}>Ação</th>
            </tr></thead>
            <tbody>{d.sugestoes.map((s, i) => (
              <tr key={i} style={{ background: i < 3 ? '#1E1F23' : 'transparent' }}>
                <td style={S.td}><div style={{ fontWeight: 600 }}>{s.equipamento}</div><div style={{ fontSize: 10, color: ACCENT }}>{s.codigo}</div></td>
                <td style={{ ...S.td, fontWeight: 700, color: s.totalOS > 50 ? '#EF4444' : s.totalOS > 20 ? '#F59E0B' : '#0F172A' }}>{s.totalOS}</td>
                <td style={S.td}><span style={badge('#F59E0B')}>{s.principalFalha} ({s.qtdPrincipal}x)</span></td>
                <td style={{ ...S.td, color: '#3B82F6' }}>{s.tempoMedio}min</td>
                <td style={S.td}><span style={badge('#22C55E')}>{s.sugestaoPeriodicidade}</span></td>
                <td style={S.td}><button style={{ ...S.btnS, padding: '4px 10px', minHeight: 28, fontSize: 10 }} onClick={async () => {
                  await supabase.from('planejamento_manutencao').insert({
                    descricao: s.sugestaoDescricao, periodicidade: s.sugestaoPeriodicidade,
                    data_programada: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], ativo: true,
                  })
                  alert('Plano criado! Veja na tela Preventiva.')
                }}>📅 Criar Plano</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      }
    </>}
  </div>
}

// ══════════════════════════════════════════════════════
//  PREVENTIVA & CALENDÁRIO
// ══════════════════════════════════════════════════════
export function Preventiva() {
  const { data, loading, insert, update, remove, refetch } = useTable('planejamento_manutencao', { order: 'data_programada', ascending: true })
  const { areas, equipamentos } = useLookups()
  const vp = useViewport()
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)
  const [viewMode, setViewMode] = useState('calendario')
  const [mesAtual, setMesAtual] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })

  const novo = () => { setItem({ descricao: '', codigo: '', equipamento_id: '', area_id: '', periodicidade: 'Mensal', data_base: '', data_programada: '', responsavel: '', duracao_estimada_min: 60, ativo: true }); setModal('novo') }
  const salvar = async () => {
    if (!(item.descricao || '').trim()) return
    const p = { ...item }; delete p.id; delete p.created_at; delete p.updated_at
    Object.keys(p).forEach(k => { if (p[k] === '') p[k] = null })
    if (item.id) await update(item.id, p); else await insert(p)
    setModal(null)
  }

  const calendarDays = useMemo(() => {
    const [year, month] = mesAtual.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const startPad = firstDay.getDay()
    const days = []
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
    return days
  }, [mesAtual])

  const planByDate = useMemo(() => {
    const map = {}
    // Janela: 6 meses atrás até 12 meses à frente do mês visível
    const [vy, vm] = mesAtual.split('-').map(Number)
    const inicio = new Date(vy, vm - 7, 1)
    const fim = new Date(vy, vm + 12, 0)

    const intervaloDias = {
      'Diária': 1, 'Diaria': 1,
      'Semanal': 7,
      'Quinzenal': 14,
      'Mensal': 30,
      'Bimestral': 60,
      'Trimestral': 90,
      'Semestral': 180,
      'Anual': 365,
    }

    data.filter(p => p.data_programada && p.ativo !== false).forEach(p => {
      const baseDate = new Date(p.data_programada.substring(0, 10) + 'T00:00:00')
      const step = intervaloDias[p.periodicidade] || 0
      if (step === 0) {
        // Sem periodicidade: só uma ocorrência
        const d = p.data_programada.substring(0, 10)
        if (!map[d]) map[d] = []
        map[d].push(p)
        return
      }
      // Gera ocorrências dentro da janela
      // Recua até antes do início, depois avança
      let cur = new Date(baseDate)
      while (cur > inicio) cur.setDate(cur.getDate() - step)
      while (cur < inicio) cur.setDate(cur.getDate() + step)
      while (cur <= fim) {
        const ds = cur.toISOString().split('T')[0]
        if (!map[ds]) map[ds] = []
        map[ds].push(p)
        cur.setDate(cur.getDate() + step)
      }
    })
    return map
  }, [data, mesAtual])

  const prevMonth = () => { const [y, m] = mesAtual.split('-').map(Number); const d = new Date(y, m - 2, 1); setMesAtual(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const nextMonth = () => { const [y, m] = mesAtual.split('-').map(Number); const d = new Date(y, m, 1); setMesAtual(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const mesNome = new Date(mesAtual + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const vencidos = data.filter(p => p.ativo !== false && p.data_programada && new Date(p.data_programada) < new Date())
  const proximos = data.filter(p => p.ativo !== false && p.data_programada && new Date(p.data_programada) >= new Date()).slice(0, 10)

  const exportarCSV = async () => {
    const ativos = data.filter(p => p.ativo !== false)
    if (ativos.length === 0) { alert('Nenhum plano para exportar'); return }
    // Buscar materiais de todos os planos
    const ids = ativos.map(p => p.id)
    let allMats = []
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200)
      const { data: rows } = await supabase.from('planejamento_materiais')
        .select('*,materiais(nome,codigo,unidade)').in('planejamento_id', batch)
      if (rows) allMats = allMats.concat(rows)
    }
    const matsByPlan = {}
    allMats.forEach(m => { if (!matsByPlan[m.planejamento_id]) matsByPlan[m.planejamento_id] = []; matsByPlan[m.planejamento_id].push(m) })

    const esc = (v) => { const s = String(v ?? '').replace(/"/g, '""'); return `"${s}"` }
    const headers = ['Código','Descrição','Procedimento','Equipamento','Cód.Equip','Área','Periodicidade','Data Programada','Responsável','Duração (min)','Materiais']
    const rows = ativos.map(p => {
      const eq = equipamentos.find(e => e.id === p.equipamento_id)
      const ar = areas.find(a => a.id === p.area_id)
      const mats = (matsByPlan[p.id] || []).map(m => `${m.materiais?.nome || m.descricao || '?'} (${m.quantidade}${m.materiais?.unidade ? ' ' + m.materiais.unidade : ''})`).join(' | ')
      return [
        p.codigo || '', p.descricao || '', (p.descricao_plano || '').replace(/\r?\n/g, ' '),
        eq?.nome || '', eq?.codigo || '', ar?.nome || '',
        p.periodicidade || '', p.data_programada ? p.data_programada.substring(0, 10) : '',
        p.responsavel || '', p.duracao_estimada_min || 0, mats,
      ].map(esc).join(';')
    })
    const csv = '﻿' + headers.map(esc).join(';') + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `plano_preventivo_manutelos_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const exportarHTML = async () => {
    const ativos = data.filter(p => p.ativo !== false).sort((a, b) => (a.data_programada || '').localeCompare(b.data_programada || ''))
    if (ativos.length === 0) { alert('Nenhum plano para exportar'); return }
    const ids = ativos.map(p => p.id)
    let allMats = []
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200)
      const { data: rows } = await supabase.from('planejamento_materiais')
        .select('*,materiais(nome,codigo,unidade)').in('planejamento_id', batch)
      if (rows) allMats = allMats.concat(rows)
    }
    const matsByPlan = {}
    allMats.forEach(m => { if (!matsByPlan[m.planejamento_id]) matsByPlan[m.planejamento_id] = []; matsByPlan[m.planejamento_id].push(m) })

    const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    const linhas = ativos.map((p, i) => {
      const eq = equipamentos.find(e => e.id === p.equipamento_id)
      const ar = areas.find(a => a.id === p.area_id)
      const mats = (matsByPlan[p.id] || []).map(m => `${m.materiais?.nome || m.descricao || '?'} (${m.quantidade}${m.materiais?.unidade ? ' ' + m.materiais.unidade : ''})`).join(', ')
      return `<tr>
        <td>${i + 1}</td>
        <td><b>${esc(p.descricao || '')}</b>${p.descricao_plano ? `<br><small style="color:#666">${esc(p.descricao_plano)}</small>` : ''}</td>
        <td>${esc(eq?.nome || '—')}<br><small>${esc(eq?.codigo || '')}</small></td>
        <td>${esc(ar?.nome || '—')}</td>
        <td>${esc(p.periodicidade || '—')}</td>
        <td>${p.data_programada ? new Date(p.data_programada).toLocaleDateString('pt-BR') : '—'}</td>
        <td>${esc(p.responsavel || '—')}</td>
        <td>${p.duracao_estimada_min || 0} min</td>
        <td><small>${esc(mats || '—')}</small></td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plano Preventivo MANUTELOS</title>
<style>
body{font-family:Arial,sans-serif;color:#0F172A;margin:20px}
h1{color:#1E40AF;letterspacing:2px;border-bottom:3px solid #1E40AF;padding-bottom:8px}
.meta{color:#64748B;font-size:11px;margin-bottom:18px}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#1E40AF;color:#fff;padding:8px 6px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px}
td{padding:6px;border-bottom:1px solid #E2E8F0;vertical-align:top}
tr:nth-child(even){background:#F8FAFC}
small{font-size:10px;color:#64748B}
@media print{body{margin:10mm}th{background:#1E40AF !important;-webkit-print-color-adjust:exact}}
</style></head><body>
<h1>PLANO PREVENTIVO DE MANUTENÇÃO — MANUTELOS</h1>
<div class="meta">Fábrica de Algodão Telos · ${ativos.length} planos ativos · Emitido em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</div>
<table>
<thead><tr><th>#</th><th>Descrição / Procedimento</th><th>Equipamento</th><th>Área</th><th>Periodicidade</th><th>Programada</th><th>Responsável</th><th>Duração</th><th>Materiais</th></tr></thead>
<tbody>${linhas}</tbody></table>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const [gerandoIA, setGerandoIA] = useState(false)
  const [previewIA, setPreviewIA] = useState(null)

  const analisarHistorico = async () => {
    setGerandoIA(true)
    // Buscar OS dos últimos 3 anos
    const from = new Date(); from.setFullYear(from.getFullYear() - 3)
    const fromStr = from.toISOString().split('T')[0]
    let allOS = [], pg = 0
    while (true) {
      const { data: rows } = await supabase.from('ordens_servico')
        .select('id,equipamento_id,data_abertura,tipo_falha_id,tipo_manutencao_id,equipamentos(id,codigo,nome,area_id),tipos_manutencao(nome),tipos_falha(nome)')
        .gte('data_abertura', fromStr).range(pg * 1000, (pg + 1) * 1000 - 1)
      if (!rows || rows.length === 0) break
      allOS = allOS.concat(rows)
      if (rows.length < 1000) break
      pg++; if (pg > 30) break
    }
    // Agrupar por equipamento
    const eqMap = {}
    allOS.forEach(o => {
      if (!o.equipamento_id || !o.equipamentos) return
      const id = o.equipamento_id
      if (!eqMap[id]) eqMap[id] = { eq: o.equipamentos, total: 0, corretivas: 0, datas: [], falhas: {} }
      eqMap[id].total++
      if (o.tipos_manutencao?.nome === 'Corretiva') eqMap[id].corretivas++
      eqMap[id].datas.push(new Date(o.data_abertura))
      const f = o.tipos_falha?.nome || 'Mecânica'
      eqMap[id].falhas[f] = (eqMap[id].falhas[f] || 0) + 1
    })
    // Classificar
    const candidatos = []
    Object.entries(eqMap).forEach(([id, e]) => {
      if (e.corretivas < 10) return
      e.datas.sort((a, b) => a - b)
      const dias = (e.datas[e.datas.length - 1] - e.datas[0]) / 86400000
      const mtbf = dias / e.total
      let periodicidade, offsetDias, duracao
      if (mtbf < 3) { periodicidade = 'Semanal'; offsetDias = 7; duracao = 60 }
      else if (mtbf < 7) { periodicidade = 'Quinzenal'; offsetDias = 14; duracao = 90 }
      else if (mtbf < 15) { periodicidade = 'Mensal'; offsetDias = 30; duracao = 120 }
      else { periodicidade = 'Trimestral'; offsetDias = 90; duracao = 180 }
      const falhaTop = Object.entries(e.falhas).sort((a, b) => b[1] - a[1])[0][0]
      candidatos.push({ eq_id: id, eq: e.eq, corretivas: e.corretivas, mtbf, periodicidade, offsetDias, duracao, falhaTop })
    })
    // Filtrar já existentes
    const { data: existentes } = await supabase.from('planejamento_manutencao').select('equipamento_id,descricao').like('descricao', 'Inspeção Preventiva%')
    const existeSet = new Set((existentes || []).map(p => p.equipamento_id))
    const novos = candidatos.filter(c => !existeSet.has(c.eq_id))
    setPreviewIA({ candidatos, novos, jaExistem: candidatos.length - novos.length })
    setGerandoIA(false)
  }

  const procedimentos = {
    'Mecânica': '1. Verificar ruídos anormais e vibração excessiva\n2. Inspecionar correias, polias e tensão\n3. Verificar rolamentos e mancais (lubrificação)\n4. Checar engrenagens (folga e desgaste)\n5. Inspecionar fixações e parafusos\n6. Verificar alinhamento de eixos\n7. Limpar e lubrificar componentes móveis\n8. Registrar leituras de temperatura',
    'Elétrica': '1. Verificar painel elétrico (aquecimento, conexões)\n2. Inspecionar cabos e conexões (oxidação)\n3. Medir tensão e corrente nominal\n4. Testar disjuntores e contatores\n5. Verificar isolação dos motores\n6. Checar botoeiras, relés e sensores\n7. Inspecionar aterramento\n8. Limpar painéis e ventiladores',
    'Hidráulica': '1. Verificar nível e qualidade do óleo hidráulico\n2. Inspecionar mangueiras (vazamentos, fissuras)\n3. Checar pressão de trabalho\n4. Verificar bomba (ruído, vibração)\n5. Inspecionar válvulas e cilindros\n6. Testar elementos filtrantes\n7. Verificar temperatura do fluido\n8. Apertar conexões hidráulicas',
    'Pneumática': '1. Verificar pressão da linha de ar\n2. Inspecionar mangueiras e conexões\n3. Drenar reservatórios e filtros de ar\n4. Verificar lubrificador (nível e dosagem)\n5. Testar válvulas solenoides\n6. Inspecionar cilindros pneumáticos\n7. Verificar atuadores e regulagens\n8. Limpar filtros de admissão',
    'Predial': '1. Inspeção geral da estrutura\n2. Verificar instalações elétricas prediais\n3. Checar hidráulica predial\n4. Inspecionar iluminação\n5. Verificar condições de pisos e paredes\n6. Limpeza de calhas e telhados\n7. Inspeção de portas e janelas\n8. Verificar sistema de segurança',
  }

  const confirmarGeracao = async () => {
    if (!previewIA?.novos?.length) return
    setGerandoIA(true)
    const hoje = new Date().toISOString().split('T')[0]
    const planos = previewIA.novos.map(c => {
      const dp = new Date(); dp.setDate(dp.getDate() + c.offsetDias)
      return {
        descricao: `Inspeção Preventiva - ${c.eq.nome}`,
        descricao_plano: procedimentos[c.falhaTop] || procedimentos['Mecânica'],
        codigo: 'PI-' + (c.eq.codigo || c.eq_id.substring(0, 8)),
        equipamento_id: c.eq_id,
        area_id: c.eq.area_id || null,
        periodicidade: c.periodicidade,
        data_base: hoje,
        data_programada: dp.toISOString().split('T')[0],
        responsavel: 'Equipe Manutenção',
        duracao_estimada_min: c.duracao,
        ativo: true,
      }
    })
    // Inserir em batches
    for (let i = 0; i < planos.length; i += 100) {
      await supabase.from('planejamento_manutencao').insert(planos.slice(i, i + 100))
    }
    setGerandoIA(false); setPreviewIA(null); refetch()
    alert(`✅ ${planos.length} planos de inspeção criados!`)
  }

  const [gerandoOS, setGerandoOS] = useState(false)

  const acionarCron = async () => {
    if (!window.confirm('Gerar agora as OS preventivas de hoje?\n\nEsta ação consulta o cron automatizado que cria OS para todos os planos vencidos e reprograma para a próxima ocorrência.')) return
    setGerandoOS(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/preventiva-cron?secret=manutelos-cron-2026`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      })
      const result = await res.json()
      if (res.ok && result.success) {
        alert(`✅ Cron executado!\n\nOS geradas: ${result.gerados}\nPlanos verificados: ${result.total_planos}\nJá existentes hoje: ${result.ja_criadas}\n${result.erros?.length ? '\nErros: ' + result.erros.join('; ') : ''}`)
        refetch()
      } else {
        alert(`Erro: ${result.error || 'Falha desconhecida'}`)
      }
    } catch (e) {
      alert(`Erro de conexão: ${e.message}`)
    }
    setGerandoOS(false)
  }

  const gerarOSDosVencidos = async () => {
    const vencs = data.filter(p => p.ativo !== false && p.data_programada && new Date(p.data_programada) < new Date())
    if (vencs.length === 0) { alert('Não há planos vencidos.'); return }
    if (!window.confirm(`Gerar ${vencs.length} OS preventivas a partir dos planos vencidos?`)) return
    setGerandoOS(true)
    const stAberta = (await supabase.from('status_os').select('id').eq('nome', 'Aberta').single()).data
    const tipoPrev = (await supabase.from('tipos_manutencao').select('id').eq('nome', 'Preventiva').single()).data
    let criadas = 0
    const intervaloDias = { 'Diária': 1, 'Diaria': 1, 'Semanal': 7, 'Quinzenal': 14, 'Mensal': 30, 'Bimestral': 60, 'Trimestral': 90, 'Semestral': 180, 'Anual': 365 }
    for (const p of vencs) {
      const eq = equipamentos.find(e => e.id === p.equipamento_id)
      const { error } = await supabase.from('ordens_servico').insert({
        titulo: p.descricao,
        descricao: p.descricao_plano || p.descricao,
        equipamento_id: p.equipamento_id || null,
        area_id: p.area_id || eq?.area_id || null,
        status_id: stAberta?.id,
        tipo_manutencao_id: tipoPrev?.id,
        prioridade: 'Media',
        solicitante: 'Plano Preventivo',
        data_abertura: new Date().toISOString(),
      })
      if (!error) {
        criadas++
        // Avançar próxima data programada
        const step = intervaloDias[p.periodicidade]
        if (step) {
          const next = new Date(p.data_programada); next.setDate(next.getDate() + step)
          await supabase.from('planejamento_manutencao').update({ data_programada: next.toISOString().split('T')[0] }).eq('id', p.id)
        }
      }
    }
    setGerandoOS(false); refetch()
    alert(`✅ ${criadas} OS preventivas criadas! Os planos foram reprogramados para a próxima ocorrência.`)
  }

  if (loading) return <Loading />

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
      <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: vp.isMobile ? 22 : 30, letterSpacing: 2, color: ACCENT }}>MANUTENÇÃO PREVENTIVA</h1>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={{ ...S.btnS, color: '#3B82F6', borderColor: '#3B82F6', fontWeight: 700 }} onClick={acionarCron} disabled={gerandoOS}>🤖 {gerandoOS ? 'Executando...' : 'Cron Diário'}</button>
        <button style={{ ...S.btnS, color: '#EF4444', borderColor: '#EF4444', fontWeight: 700 }} onClick={gerarOSDosVencidos} disabled={gerandoOS}>⚠️ {gerandoOS ? 'Gerando...' : `Gerar OS Vencidas (${vencidos.length})`}</button>
        <button style={{ ...S.btnS, color: '#F59E0B', borderColor: '#F59E0B', fontWeight: 700 }} onClick={analisarHistorico} disabled={gerandoIA}>🤖 {gerandoIA ? 'Analisando...' : 'Gerar Plano IA'}</button>
        <button style={{ ...S.btnS, color: '#22C55E', borderColor: '#22C55E' }} onClick={exportarCSV}>📊 CSV</button>
        <button style={{ ...S.btnS, color: '#A855F7', borderColor: '#A855F7' }} onClick={exportarHTML}>🖨️ Imprimir</button>
        <button style={S.btnP} onClick={novo}>+ NOVO PLANO</button>
      </div>
    </div>

    {/* Modal preview Plano IA */}
    {previewIA && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPreviewIA(null)}>
      <div style={{ background: '#FFF', borderRadius: 12, maxWidth: 700, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, color: '#F59E0B', fontSize: 18 }}>🤖 Plano de Inspeção Inteligente</h2>
          <span style={{ cursor: 'pointer', fontSize: 20, color: '#94A3B8' }} onClick={() => setPreviewIA(null)}>✕</span>
        </div>
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12, color: '#92400E' }}>
          Análise baseada em <b>3 anos de histórico de OS</b>. Equipamentos com 10+ corretivas foram classificados pelo MTBF (tempo médio entre falhas).
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120, background: '#F1F5F9', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#22C55E' }}>{previewIA.novos.length}</div>
            <div style={{ fontSize: 10, color: '#64748B' }}>Novos planos</div>
          </div>
          <div style={{ flex: 1, minWidth: 120, background: '#F1F5F9', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#94A3B8' }}>{previewIA.jaExistem}</div>
            <div style={{ fontSize: 10, color: '#64748B' }}>Já existem</div>
          </div>
        </div>
        {['Semanal', 'Quinzenal', 'Mensal', 'Trimestral'].map(per => {
          const itens = previewIA.novos.filter(c => c.periodicidade === per)
          if (itens.length === 0) return null
          const cor = { Semanal: '#EF4444', Quinzenal: '#F59E0B', Mensal: '#3B82F6', Trimestral: '#22C55E' }[per]
          return <div key={per} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: cor, textTransform: 'uppercase', marginBottom: 4 }}>{per} ({itens.length})</div>
            {itens.slice(0, 8).map(c => <div key={c.eq_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9', fontSize: 11 }}>
              <span style={{ color: '#0F172A' }}>{c.eq.codigo} - {c.eq.nome}</span>
              <span style={{ color: '#64748B' }}>{c.corretivas} OS · MTBF {c.mtbf.toFixed(1)}d · {c.falhaTop}</span>
            </div>)}
            {itens.length > 8 && <div style={{ fontSize: 10, color: '#94A3B8', paddingTop: 4 }}>+ {itens.length - 8} mais...</div>}
          </div>
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: '1px solid #E2E8F0', marginTop: 14 }}>
          <button style={S.btnS} onClick={() => setPreviewIA(null)}>Cancelar</button>
          <button style={{ ...S.btnP, opacity: previewIA.novos.length > 0 && !gerandoIA ? 1 : .4 }} disabled={gerandoIA || previewIA.novos.length === 0} onClick={confirmarGeracao}>
            {gerandoIA ? 'Criando...' : `✅ Criar ${previewIA.novos.length} Planos`}
          </button>
        </div>
      </div>
    </div>}

    {/* Resumo */}
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      <KPI label="Planos Ativos" value={data.filter(p => p.ativo !== false).length} accent={ACCENT} small />
      <KPI label="Vencidos" value={vencidos.length} accent="#EF4444" sub="Atenção!" small />
      <KPI label="Próximos 30 dias" value={data.filter(p => p.ativo !== false && p.data_programada && new Date(p.data_programada) <= new Date(Date.now() + 30 * 86400000) && new Date(p.data_programada) >= new Date()).length} accent="#F59E0B" small />
    </div>

    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <button style={viewMode === 'calendario' ? S.btnP : { ...S.btnS }} onClick={() => setViewMode('calendario')}>📅 Calendário</button>
      <button style={viewMode === 'lista' ? S.btnP : { ...S.btnS }} onClick={() => setViewMode('lista')}>📋 Lista</button>
    </div>

    {viewMode === 'calendario' ? (
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button style={S.btnS} onClick={prevMonth}>◀</button>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: ACCENT, letterSpacing: 1, textTransform: 'capitalize' }}>{mesNome}</h3>
          <button style={S.btnS} onClick={nextMonth}>▶</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 9, color: '#94A3B8', padding: 3, fontWeight: 600 }}>{d}</div>)}
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={`p${i}`} />
            const dateStr = `${mesAtual}-${String(day).padStart(2, '0')}`
            const plans = planByDate[dateStr] || []
            const isToday = dateStr === new Date().toISOString().split('T')[0]
            const isPast = new Date(dateStr) < new Date() && !isToday
            return <div key={i} style={{
              background: plans.length > 0 ? (isPast ? '#3B1F1F' : '#DBEAFE') : '#F1F5F9',
              border: isToday ? `2px solid ${ACCENT}` : '1px solid #E2E8F0',
              borderRadius: 4, padding: 4, minHeight: vp.isMobile ? 36 : 56, cursor: plans.length > 0 ? 'pointer' : 'default',
            }} onClick={() => plans.length > 0 && (setItem(plans[0]), setModal('editar'))}>
              <div style={{ fontSize: 11, color: isToday ? ACCENT : '#64748B', fontWeight: isToday ? 700 : 400 }}>{day}</div>
              {plans.slice(0, 2).map(p => <div key={p.id} style={{ fontSize: 8, color: isPast ? '#EF4444' : '#3B82F6', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🔧 {(p.descricao || '').substring(0, 12)}
              </div>)}
              {plans.length > 2 && <div style={{ fontSize: 8, color: '#94A3B8' }}>+{plans.length - 2}</div>}
            </div>
          })}
        </div>
      </div>
    ) : (
      <>
        {/* Vencidos */}
        {vencidos.length > 0 && <div style={{ ...S.card, borderLeft: '3px solid #EF4444', marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 11, color: '#EF4444', textTransform: 'uppercase' }}>⚠️ Planos Vencidos ({vencidos.length})</h3>
          {vencidos.slice(0, 10).map(p => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }} onClick={() => { setItem({ ...p }); setModal('editar') }}>
            <div><div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{p.descricao}</div><div style={{ fontSize: 10, color: '#EF4444' }}>Vencido em {fmtDate(p.data_programada)}</div></div>
            <span style={badge('#EF4444')}>{p.periodicidade}</span>
          </div>)}
        </div>}

        {/* Próximos */}
        <div style={S.card}>
          <h3 style={{ margin: '0 0 10px', fontSize: 11, color: '#64748B', textTransform: 'uppercase' }}>📅 Próximos Planos</h3>
          {proximos.length === 0 ? <Empty icon="📅" msg="Nenhum plano programado" action="Criar Plano" onAction={novo} /> :
            proximos.map(p => {
              const eq = equipamentos.find(e => e.id === p.equipamento_id)
              return <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }} onClick={() => { setItem({ ...p }); setModal('editar') }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{p.descricao}</div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{eq ? `⚙️ ${eq.nome}` : ''} · {fmtDate(p.data_programada)}</div>
                </div>
                <span style={badge('#3B82F6')}>{p.periodicidade}</span>
              </div>
            })}
        </div>

        {/* Todos */}
        <div style={S.card}>
          <h3 style={{ margin: '0 0 10px', fontSize: 11, color: '#64748B', textTransform: 'uppercase' }}>Todos os Planos ({data.filter(p => p.ativo !== false).length})</h3>
          {data.filter(p => p.ativo !== false).map(p => {
            const venc = p.data_programada && new Date(p.data_programada) < new Date()
            return <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }} onClick={() => { setItem({ ...p }); setModal('editar') }}>
              <span style={{ fontSize: 11, color: venc ? '#EF4444' : '#334155' }}>{p.descricao}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#64748B' }}>{fmtDate(p.data_programada)}</span>
                <span style={badge(venc ? '#EF4444' : '#3B82F6')}>{p.periodicidade}</span>
              </div>
            </div>
          })}
        </div>
      </>
    )}

    <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'NOVO PLANO PREVENTIVO' : modal === 'exportar' ? 'EXPORTAR PLANO' : 'EDITAR PLANO'} mobile={vp.isMobile}>
      {item && modal !== 'exportar' && <div>
        <Field label="Título do Plano" req><input style={S.input} value={item.descricao || ''} onChange={e => setItem({ ...item, descricao: e.target.value })} placeholder="Ex: Lubrificação mensal cardas" /></Field>
        <Field label="Descrição Detalhada / Procedimento">
          <textarea style={{ ...S.input, minHeight: 100, resize: 'vertical' }} value={item.descricao_plano || ''} onChange={e => setItem({ ...item, descricao_plano: e.target.value })} placeholder="Descreva passo a passo o que deve ser realizado na preventiva..." />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? '1fr' : '1fr 1fr', gap: '0 14px' }}>
          <Field label="Equipamento"><select style={S.select} value={item.equipamento_id || ''} onChange={e => setItem({ ...item, equipamento_id: e.target.value })}>
            <option value="">Selecione</option>{equipamentos.map(e => <option key={e.id} value={e.id}>{e.nome}{e.codigo ? ` (${e.codigo})` : ''}</option>)}
          </select></Field>
          <Field label="Área"><select style={S.select} value={item.area_id || ''} onChange={e => setItem({ ...item, area_id: e.target.value })}>
            <option value="">Selecione</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select></Field>
          <Field label="Periodicidade"><select style={S.select} value={item.periodicidade || ''} onChange={e => setItem({ ...item, periodicidade: e.target.value })}>
            <option value="">Selecione</option>{PERIODICIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select></Field>
          <Field label="Data Programada"><input style={S.input} type="date" value={item.data_programada || ''} onChange={e => setItem({ ...item, data_programada: e.target.value })} /></Field>
          <Field label="Responsável"><input style={S.input} value={item.responsavel || ''} onChange={e => setItem({ ...item, responsavel: e.target.value })} /></Field>
          <Field label="Duração Estimada (min)"><input style={S.input} type="number" min="0" value={item.duracao_estimada_min || 60} onChange={e => setItem({ ...item, duracao_estimada_min: parseInt(e.target.value) || 0 })} /></Field>
        </div>

        {/* Materiais do plano */}
        {item.id && <PrevMateriais planoId={item.id} />}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #E2E8F0', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {modal === 'editar' && <button style={S.btnD} onClick={async () => { await remove(item.id); setModal(null) }}>Excluir</button>}
            {modal === 'editar' && item.id && <button style={{ ...S.btnS, color: '#A855F7', borderColor: '#A855F7' }} onClick={() => setModal('exportar')}>📤 Exportar</button>}
            {modal === 'editar' && item.id && <button style={{ ...S.btnS, color: '#22C55E', borderColor: '#22C55E' }} onClick={async () => {
              const stAberta = (await supabase.from('status_os').select('id').eq('nome', 'Aberta').single()).data
              const tipoPrev = (await supabase.from('tipos_manutencao').select('id').eq('nome', 'Preventiva').single()).data
              const eq = equipamentos.find(e => e.id === item.equipamento_id)
              await supabase.from('ordens_servico').insert({
                titulo: item.descricao, descricao: item.descricao_plano || item.descricao,
                equipamento_id: item.equipamento_id || null, area_id: item.area_id || null,
                status_id: stAberta?.id, tipo_manutencao_id: tipoPrev?.id,
                prioridade: 'Media', solicitante: 'Plano Preventivo',
                data_abertura: new Date().toISOString(),
              })
              alert('OS Preventiva criada com sucesso!')
            }}>📋 Gerar OS</button>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}><button style={S.btnS} onClick={() => setModal(null)}>Cancelar</button><button style={S.btnP} onClick={salvar}>Salvar</button></div>
        </div>
      </div>}

      {/* Export plan to other equipment */}
      {item && modal === 'exportar' && <ExportarPlano plano={item} equipamentos={equipamentos} areas={areas} onDone={async (eqIds) => {
        for (const eqId of eqIds) {
          const eq = equipamentos.find(e => e.id === eqId)
          await supabase.from('planejamento_manutencao').insert({
            descricao: `${item.descricao} - ${eq?.nome || ''}`,
            descricao_plano: item.descricao_plano,
            equipamento_id: eqId, area_id: eq?.area_id || item.area_id,
            periodicidade: item.periodicidade, data_programada: item.data_programada,
            responsavel: item.responsavel, duracao_estimada_min: item.duracao_estimada_min, ativo: true,
          })
        }
        alert(`Plano exportado para ${eqIds.length} equipamento(s)!`)
        setModal(null); refetch()
      }} onCancel={() => setModal('editar')} />}
    </Modal>
  </div>
}

// ── Materiais do Plano Preventivo ──
function PrevMateriais({ planoId }) {
  const [mats, setMats] = useState([])
  const [allMats, setAllMats] = useState([])
  const [sel, setSel] = useState('')
  const [qtd, setQtd] = useState(1)
  useEffect(() => {
    supabase.from('preventiva_materiais').select('*,materiais(nome,codigo,unidade)').eq('plano_id', planoId).then(({ data }) => setMats(data || []))
    supabase.from('materiais').select('id,nome,codigo,unidade').order('nome').then(({ data }) => setAllMats(data || []))
  }, [planoId])
  const add = async () => {
    if (!sel) return; const mat = allMats.find(m => m.id === sel)
    const { data: row } = await supabase.from('preventiva_materiais').insert({ plano_id: planoId, material_id: sel, descricao: mat?.nome, quantidade: qtd }).select('*,materiais(nome,codigo,unidade)').single()
    if (row) setMats(p => [...p, row]); setSel(''); setQtd(1)
  }
  const rem = async (m) => { await supabase.from('preventiva_materiais').delete().eq('id', m.id); setMats(p => p.filter(x => x.id !== m.id)) }
  return <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 12, marginTop: 14 }}>
    <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>📦 Materiais Necessários ({mats.length})</div>
    {mats.map(m => <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #222', fontSize: 11 }}>
      <span style={{ color: '#334155' }}>{m.materiais?.nome || m.descricao} ({m.materiais?.codigo})</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ color: '#3B82F6', fontWeight: 700 }}>{m.quantidade} {m.materiais?.unidade}</span><span style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => rem(m)}>✕</span></div>
    </div>)}
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      <select style={{ ...S.select, flex: 1, fontSize: 11, minWidth: 140 }} value={sel} onChange={e => setSel(e.target.value)}><option value="">Material...</option>{allMats.map(m => <option key={m.id} value={m.id}>{m.nome} ({m.codigo})</option>)}</select>
      <input style={{ ...S.input, width: 55, textAlign: 'center', marginBottom: 0 }} type="number" min="1" value={qtd} onChange={e => setQtd(parseInt(e.target.value) || 1)} />
      <button style={{ ...S.btnP, padding: '6px 12px', fontSize: 10 }} onClick={add}>+ Add</button>
    </div>
  </div>
}

function ExportarPlano({ plano, equipamentos, areas, onDone, onCancel }) {
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const toggle = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const filtered = search ? equipamentos.filter(e => (e.nome || '').toLowerCase().includes(search.toLowerCase()) || (e.codigo || '').toLowerCase().includes(search.toLowerCase())) : equipamentos
  return <div>
    <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 12, marginBottom: 14, borderLeft: '3px solid #A855F7' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#A855F7' }}>Exportando: {plano.descricao}</div>
      <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Selecione os equipamentos que receberão cópia deste plano.</div>
    </div>
    <input style={{ ...S.input, marginBottom: 8 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar equipamento..." />
    {selected.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
      {selected.map(id => { const eq = equipamentos.find(e => e.id === id); return eq ? <span key={id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', background: '#A855F720', color: '#A855F7', borderRadius: 6, padding: '3px 8px', fontSize: 10 }}>{eq.nome} <span style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => toggle(id)}>✕</span></span> : null })}
    </div>}
    <div style={{ maxHeight: 250, overflow: 'auto', border: '1px solid #222', borderRadius: 6 }}>
      {filtered.map(eq => <label key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', background: selected.includes(eq.id) ? '#A855F710' : 'transparent' }}>
        <input type="checkbox" checked={selected.includes(eq.id)} onChange={() => toggle(eq.id)} style={{ width: 16, height: 16 }} />
        <span style={{ fontSize: 12, color: selected.includes(eq.id) ? '#A855F7' : '#94A3B8' }}>{eq.nome}{eq.codigo ? ` (${eq.codigo})` : ''}</span>
      </label>)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
      <button style={S.btnS} onClick={onCancel}>◀ Voltar</button>
      <button style={{ ...S.btnP, opacity: selected.length > 0 ? 1 : .4 }} onClick={() => selected.length > 0 && onDone(selected)} disabled={selected.length === 0}>📤 Exportar para {selected.length} equip.</button>
    </div>
  </div>
}

// ══════════════════════════════════════════════════════
//  USUÁRIOS & PERFIS
// ══════════════════════════════════════════════════════
export function Usuarios() {
  const { data, loading, insert, update, remove } = useTable('usuarios', { order: 'nome', ascending: true })
  const { areas } = useLookups()
  const vp = useViewport()
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)
  const [tab, setTab] = useState('usuarios') // usuarios | hierarquia

  const novo = () => { setItem({ nome: '', email: '', perfil: 'solicitante', area_id: '', ativo: true, senha: '' }); setModal('novo') }
  const salvar = async () => {
    if (!(item.nome || '').trim() || !(item.email || '').trim()) return
    const p = { ...item }; delete p.id; delete p.created_at
    Object.keys(p).forEach(k => { if (p[k] === '') p[k] = null })
    if (modal === 'editar' && !p.senha) delete p.senha
    // Hash password via Edge Function before saving
    if (p.senha) {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: 'set_password', nova_senha: p.senha })
        })
        const result = await res.json()
        if (!res.ok || result.error) { alert('Erro ao processar senha: ' + (result.error || 'Erro')); return }
        p.senha = result.senha_hash
      } catch { alert('Erro de conexão ao processar senha'); return }
    }
    if (item.id) await update(item.id, p); else {
      if (!p.senha) { alert('Defina uma senha para o novo usuário'); return }
      await insert(p)
    }
    setModal(null)
  }

  // Count users per profile
  const perfilCounts = useMemo(() => {
    const map = {}
    data.forEach(u => { const p = u.perfil || '?'; map[p] = (map[p] || 0) + 1 })
    return map
  }, [data])

  if (loading) return <Loading />

  const PERM_LABELS = {
    os_criar: 'Criar OS', os_editar: 'Editar OS', os_excluir: 'Excluir OS', os_atender: 'Atender OS', os_aprovar: 'Aprovar OS',
    equip_criar: 'Criar Equip.', equip_editar: 'Editar Equip.', equip_excluir: 'Excluir Equip.',
    pecas_criar: 'Criar Peça', pecas_editar: 'Editar Peça', pecas_importar: 'Importar Estoque', pecas_exportar: 'Exportar Estoque', pecas_movimentar: 'Movimentar Est.',
    areas_criar: 'Criar Área', areas_editar: 'Editar Área',
    mecanicos_criar: 'Criar Mecânico', mecanicos_editar: 'Editar Mecânico',
    preventiva_criar: 'Criar Plano', preventiva_editar: 'Editar Plano',
    relatorios_ver: 'Ver Relatórios', relatorios_exportar: 'Exportar Relat.',
    usuarios_criar: 'Criar Usuário', usuarios_editar: 'Editar Usuário', usuarios_excluir: 'Excluir Usuário',
  }

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
      <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: vp.isMobile ? 22 : 30, letterSpacing: 2, color: ACCENT }}>USUÁRIOS & PERFIS</h1>
      <button style={S.btnP} onClick={novo}>+ NOVO USUÁRIO</button>
    </div>

    {/* Tabs */}
    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
      {[['usuarios', '👥 Usuários'], ['hierarquia', '🏛 Hierarquia de Perfis']].map(([k, l]) =>
        <button key={k} onClick={() => setTab(k)} style={{
          ...S.btnS, padding: '8px 14px', minHeight: 36, fontSize: 11, fontWeight: 600,
          background: tab === k ? ACCENT + '20' : 'transparent', color: tab === k ? ACCENT : '#64748B', borderColor: tab === k ? ACCENT : '#CBD5E1',
        }}>{l}</button>
      )}
    </div>

    {/* ── TAB: USUÁRIOS ── */}
    {tab === 'usuarios' && <>
      {/* Summary cards per profile */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {PERFIS.map(pk => {
          const pc = getPerfil(pk)
          const cnt = perfilCounts[pk] || 0
          return <div key={pk} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>{pc.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: pc.cor }}>{cnt}</div>
              <div style={{ fontSize: 9, color: '#94A3B8' }}>{pc.label}</div>
            </div>
          </div>
        })}
      </div>

      {data.length === 0 ? <Empty icon="👥" msg="Nenhum usuário" action="Criar" onAction={novo} /> :
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>
          <th style={S.th}>Nome</th><th style={S.th}>Email</th><th style={S.th}>Perfil</th><th style={S.th}>Área</th><th style={S.th}>Status</th><th style={S.th}></th>
        </tr></thead><tbody>{data.map(u => {
          const pc = getPerfil(u.perfil)
          return <tr key={u.id}>
            <td style={{ ...S.td, fontWeight: 600 }}>{u.nome}</td>
            <td style={{ ...S.td, fontSize: 11, color: '#64748B' }}>{u.email}</td>
            <td style={S.td}><span style={{ ...badge(pc.cor), display: 'inline-flex', gap: 4, alignItems: 'center' }}>{pc.icon} {pc.label}</span></td>
            <td style={{ ...S.td, fontSize: 11, color: '#64748B' }}>{areas.find(a => a.id === u.area_id)?.nome || 'Todas'}</td>
            <td style={S.td}><span style={badge(u.ativo ? '#22C55E' : '#EF4444')}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td style={S.td}><button style={{ ...S.btnS, padding: '3px 8px', minHeight: 28, fontSize: 10 }} onClick={() => { setItem({ ...u }); setModal('editar') }}>✏️</button></td>
          </tr>
        })}</tbody></table></div>
      }
    </>}

    {/* ── TAB: HIERARQUIA DE PERFIS ── */}
    {tab === 'hierarquia' && <>
      <div style={{ marginBottom: 16 }}>
        {PERFIS.map(pk => {
          const pc = getPerfil(pk)
          const cnt = perfilCounts[pk] || 0
          const usersOfProfile = data.filter(u => u.perfil === pk)
          return <div key={pk} style={{ ...S.card, marginBottom: 12, borderLeft: `3px solid ${pc.cor}` }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 28 }}>{pc.icon}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: pc.cor }}>{pc.label}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>Nível {pc.nivel} · {cnt} usuário{cnt !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <span style={{ ...badge(pc.cor), fontSize: 10 }}>Nível {pc.nivel}</span>
            </div>

            <div style={{ fontSize: 12, color: '#334155', marginBottom: 12, lineHeight: 1.5 }}>{pc.descricao}</div>

            {/* Pages access */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Telas com Acesso</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['dashboard', 'ordens', 'equipamentos', 'mecanicos', 'pecas', 'areas', 'preventiva', 'relatorios', 'usuarios'].map(pg => {
                  const has = pc.paginas.includes(pg)
                  return <span key={pg} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 4,
                    background: has ? pc.cor + '20' : '#F1F5F9', color: has ? pc.cor : '#333',
                    border: `1px solid ${has ? pc.cor + '40' : '#E2E8F0'}`,
                  }}>{pg}</span>
                })}
              </div>
            </div>

            {/* Permissions grid */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Permissões</div>
              <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 3 }}>
                {Object.entries(PERM_LABELS).map(([key, label]) => {
                  const has = pc.permissoes[key]
                  return <div key={key} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, display: 'flex', gap: 4, alignItems: 'center', background: has ? '#F0FDF420' : 'transparent' }}>
                    <span style={{ color: has ? '#22C55E' : '#333' }}>{has ? '✓' : '✕'}</span>
                    <span style={{ color: has ? '#334155' : '#CBD5E1' }}>{label}</span>
                  </div>
                })}
              </div>
            </div>

            {/* Users with this profile */}
            {usersOfProfile.length > 0 && <div>
              <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Usuários ({usersOfProfile.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {usersOfProfile.map(u => <span key={u.id} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6, background: '#F1F5F9', border: '1px solid #CBD5E1',
                  color: u.ativo ? '#334155' : '#94A3B8', textDecoration: u.ativo ? 'none' : 'line-through',
                }}>{u.nome}</span>)}
              </div>
            </div>}
          </div>
        })}
      </div>
    </>}

    {/* Modal */}
    <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'NOVO USUÁRIO' : 'EDITAR USUÁRIO'} mobile={vp.isMobile}>
      {item && <div>
        <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? '1fr' : '1fr 1fr', gap: '0 14px' }}>
          <Field label="Nome" req><input style={S.input} value={item.nome || ''} onChange={e => setItem({ ...item, nome: e.target.value })} /></Field>
          <Field label="Email" req><input style={S.input} type="email" value={item.email || ''} onChange={e => setItem({ ...item, email: e.target.value })} /></Field>
          <Field label={modal === 'novo' ? 'Senha' : 'Nova Senha (vazio = manter)'} req={modal === 'novo'}>
            <input style={S.input} type="password" value={item.senha || ''} onChange={e => setItem({ ...item, senha: e.target.value })} placeholder={modal === 'novo' ? 'Defina a senha' : 'Deixe vazio para manter'} />
          </Field>
          <Field label="Perfil" req>
            <select style={S.select} value={item.perfil || 'solicitante'} onChange={e => setItem({ ...item, perfil: e.target.value })}>
              {PERFIS.map(pk => { const pc = getPerfil(pk); return <option key={pk} value={pk}>{pc.icon} {pc.label} (Nível {pc.nivel})</option> })}
            </select>
          </Field>
          <Field label="Área"><select style={S.select} value={item.area_id || ''} onChange={e => setItem({ ...item, area_id: e.target.value })}>
            <option value="">Todas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select></Field>
        </div>

        {/* Preview do perfil selecionado */}
        {item.perfil && <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 12, marginTop: 10, borderLeft: `3px solid ${getPerfil(item.perfil).cor}` }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>{getPerfil(item.perfil).icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: getPerfil(item.perfil).cor }}>{getPerfil(item.perfil).label}</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>{getPerfil(item.perfil).descricao}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {getPerfil(item.perfil).paginas.map(pg => <span key={pg} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: getPerfil(item.perfil).cor + '20', color: getPerfil(item.perfil).cor }}>{pg}</span>)}
          </div>
        </div>}

        <Field label="Status"><label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44 }}>
          <input type="checkbox" checked={item.ativo !== false} onChange={e => setItem({ ...item, ativo: e.target.checked })} style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 13, color: item.ativo !== false ? '#22C55E' : '#EF4444' }}>{item.ativo !== false ? 'Ativo' : 'Inativo'}</span>
        </label></Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #E2E8F0', gap: 10, flexWrap: 'wrap' }}>
          {modal === 'editar' && <button style={S.btnD} onClick={async () => { await remove(item.id); setModal(null) }}>Excluir</button>}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}><button style={S.btnS} onClick={() => setModal(null)}>Cancelar</button><button style={S.btnP} onClick={salvar}>Salvar</button></div>
        </div>
      </div>}
    </Modal>
  </div>
}

// ══════════════════════════════════════════════════════
//  DESCRIÇÕES PADRÃO (CRUD)
// ══════════════════════════════════════════════════════
export function Descricoes() {
  const { data, loading, insert, update, remove, refetch } = useTable('descricoes_padrao', { order: 'categoria', ascending: true })
  const vp = useViewport()
  const [search, setSearch] = useState('')
  const [fCat, setFCat] = useState('TODOS')
  const [modal, setModal] = useState(null)
  const [item, setItem] = useState(null)

  const categorias = useMemo(() => [...new Set(data.map(d => d.categoria).filter(Boolean))].sort(), [data])

  const filtered = data.filter(d => {
    if (fCat !== 'TODOS' && d.categoria !== fCat) return false
    if (search) return (d.descricao || '').toLowerCase().includes(search.toLowerCase())
    return true
  })

  const novo = () => { setItem({ descricao: '', categoria: '', ativo: true }); setModal('novo') }
  const salvar = async () => {
    if (!(item.descricao || '').trim()) return
    const p = { descricao: item.descricao, categoria: item.categoria || null, ativo: item.ativo !== false }
    if (item.id) await update(item.id, p); else await insert(p)
    setModal(null)
  }

  if (loading) return <Loading />

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
      <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: vp.isMobile ? 22 : 30, letterSpacing: 2, color: ACCENT }}>DESCRIÇÕES PADRÃO</h1>
      <button style={S.btnP} onClick={novo}>+ NOVA DESCRIÇÃO</button>
    </div>

    <div style={{ ...S.card, marginBottom: 16, borderLeft: '3px solid ' + ACCENT }}>
      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
        Catálogo de descrições padronizadas para abertura de OS. O solicitante seleciona uma descrição pronta ao abrir uma OS, garantindo padronização e facilitando análises.
      </div>
    </div>

    {/* Stats */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
        <span style={{ color: '#64748B' }}>Total: </span><strong style={{ color: ACCENT }}>{data.length}</strong>
      </div>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
        <span style={{ color: '#64748B' }}>Categorias: </span><strong style={{ color: '#0F172A' }}>{categorias.length}</strong>
      </div>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
        <span style={{ color: '#64748B' }}>Ativas: </span><strong style={{ color: '#22C55E' }}>{data.filter(d => d.ativo !== false).length}</strong>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
      <Search value={search} onChange={setSearch} ph="Buscar descrição..." />
      <select style={{ ...S.select, width: 180 }} value={fCat} onChange={e => setFCat(e.target.value)}>
        <option value="TODOS">Todas Categorias</option>
        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <span style={{ fontSize: 10, color: '#94A3B8' }}>{filtered.length} itens</span>
    </div>

    {/* List grouped by category */}
    {filtered.length === 0 ? <Empty icon="📝" msg="Nenhuma descrição" action="Criar" onAction={novo} /> :
      fCat === 'TODOS' ? (
        categorias.map(cat => {
          const items = filtered.filter(d => d.categoria === cat)
          if (items.length === 0) return null
          const catColors = { 'Mecânica': '#EF4444', 'Elétrica': '#F59E0B', 'Pneumática': '#3B82F6', 'Hidráulica': '#A855F7', 'Predial': '#22C55E', 'Limpeza': '#6B7280', 'Melhoria': '#EC4899' }
          return <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ ...badge(catColors[cat] || '#64748B'), fontSize: 11, fontWeight: 700 }}>{cat}</span>
              <span style={{ fontSize: 10, color: '#94A3B8' }}>{items.length} itens</span>
            </div>
            {items.map(d => <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }} onClick={() => { setItem({ ...d }); setModal('editar') }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: d.ativo !== false ? '#0F172A' : '#94A3B8', fontSize: 13, textDecoration: d.ativo === false ? 'line-through' : 'none' }}>{d.descricao}</span>
                {d.ativo === false && <span style={badge('#EF4444')}>Inativa</span>}
              </div>
              <button style={{ ...S.btnS, padding: '3px 8px', minHeight: 26, fontSize: 10 }}>✏️</button>
            </div>)}
          </div>
        })
      ) : (
        filtered.map(d => <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }} onClick={() => { setItem({ ...d }); setModal('editar') }}>
          <span style={{ color: d.ativo !== false ? '#0F172A' : '#94A3B8', fontSize: 13 }}>{d.descricao}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {d.ativo === false && <span style={badge('#EF4444')}>Inativa</span>}
            <button style={{ ...S.btnS, padding: '3px 8px', minHeight: 26, fontSize: 10 }}>✏️</button>
          </div>
        </div>)
      )
    }

    <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'NOVA DESCRIÇÃO' : 'EDITAR DESCRIÇÃO'} mobile={vp.isMobile}>
      {item && <div>
        <Field label="Descrição" req><textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={item.descricao || ''} onChange={e => setItem({ ...item, descricao: e.target.value })} placeholder="Ex: Rolamento com ruído / travado" /></Field>
        <Field label="Categoria">
          <div style={{ display: 'flex', gap: 6 }}>
            <select style={{ ...S.select, flex: 1 }} value={item.categoria || ''} onChange={e => setItem({ ...item, categoria: e.target.value })}>
              <option value="">Selecione ou digite</option>
              {['Mecânica', 'Elétrica', 'Pneumática', 'Hidráulica', 'Predial', 'Limpeza', 'Melhoria', 'Setup', 'Instrumentação'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input style={{ ...S.input, flex: 1, marginBottom: 0 }} value={item.categoria || ''} onChange={e => setItem({ ...item, categoria: e.target.value })} placeholder="Ou nova categoria" />
          </div>
        </Field>
        <Field label="Status"><label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 40 }}>
          <input type="checkbox" checked={item.ativo !== false} onChange={e => setItem({ ...item, ativo: e.target.checked })} style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 13, color: item.ativo !== false ? '#22C55E' : '#EF4444' }}>{item.ativo !== false ? 'Ativa' : 'Inativa'}</span>
        </label></Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #E2E8F0', gap: 10, flexWrap: 'wrap' }}>
          {modal === 'editar' && <button style={S.btnD} onClick={async () => { await remove(item.id); setModal(null) }}>Excluir</button>}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}><button style={S.btnS} onClick={() => setModal(null)}>Cancelar</button><button style={S.btnP} onClick={salvar}>Salvar</button></div>
        </div>
      </div>}
    </Modal>
  </div>
}
