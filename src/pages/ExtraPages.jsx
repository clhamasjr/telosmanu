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
          .select('id,titulo,data_abertura,data_inicio,data_conclusao,tempo_execucao_min,tempo_atendimento_min,executado_por,solicitante,equipamento_id,equipamentos(id,nome,codigo),areas(nome),status_os(nome),tipos_manutencao(nome),tipos_falha(nome)')
          .gte('data_abertura', from + 'T00:00:00').lte('data_abertura', to + 'T23:59:59')
          .order('data_abertura').range(pg * 1000, (pg + 1) * 1000 - 1)
        if (!rows || rows.length === 0) break
        allOS = allOS.concat(rows)
        if (rows.length < 1000) break
        pg++; if (pg > 30) break
      }
      const { data: mecs } = await supabase.from('mecanicos').select('*').eq('ativo', true)
      const { data: hh } = await supabase.from('apontamento_hh').select('*,mecanicos(nome)')
        .gte('data_inicio', from + 'T00:00:00').lte('data_inicio', to + 'T23:59:59')

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

      // ── Disponibilidade = (tempo total - tempo parado) / tempo total ──
      const diasPeriodo = Math.max(1, (new Date(to) - new Date(from)) / 86400000)
      const diasUteis = Math.round(diasPeriodo * 5 / 7)
      const horasDisp = diasUteis * 8 // 8h por dia útil por mecânico
      const horasParadas = repairTimes.reduce((a, b) => a + b, 0)
      const horasTotaisEquip = diasPeriodo * 24
      const disponibilidade = horasTotaisEquip > 0 ? Math.min(100, ((horasTotaisEquip - horasParadas) / horasTotaisEquip * 100)) : 100

      // ── OS por mecânico / executor ──
      const mecMap = {}
      allOS.forEach(o => {
        const exec = o.executado_por || o.solicitante || 'Não atribuído'
        if (exec === 'Não atribuído') return // skip unattributed
        if (!mecMap[exec]) mecMap[exec] = { total: 0, tempoTotal: 0 }
        mecMap[exec].total++
        mecMap[exec].tempoTotal += o.tempo_execucao_min || 0
      })
      const osPorMec = Object.entries(mecMap).map(([nome, v]) => ({
        nome, total: v.total, tempoTotal: v.tempoTotal, tempoMedio: v.total > 0 ? v.tempoTotal / v.total : 0,
      })).sort((a, b) => b.total - a.total)

      // ── HH por mecânico ──
      const hhMap = {}
      ;(hh || []).forEach(h => {
        const nome = h.mecanicos?.nome || '?'
        if (!hhMap[nome]) hhMap[nome] = { horas: 0, registros: 0 }
        hhMap[nome].horas += (h.tempo_minutos || 0) / 60
        hhMap[nome].registros++
      })
      const hhPorMec = Object.entries(hhMap).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.horas - a.horas)

      // ── Top equipamentos que mais param ──
      const eqParadas = {}
      allOS.forEach(o => {
        const eqNome = o.equipamentos?.nome || 'Sem equipamento'
        const eqId = o.equipamentos?.id
        if (!eqId) return
        if (!eqParadas[eqId]) eqParadas[eqId] = { nome: eqNome, codigo: o.equipamentos?.codigo, total: 0, tempoTotal: 0, falhas: {} }
        eqParadas[eqId].total++
        eqParadas[eqId].tempoTotal += o.tempo_execucao_min || 0
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
          tempoMedio: e.total > 0 ? Math.round(e.tempoTotal / e.total) : 0,
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
  const Bar = ({ items, color }) => items.length === 0 ? <div style={{ color: '#555', textAlign: 'center', padding: 12, fontSize: 11 }}>Sem dados</div> :
    items.slice(0, 10).map(([label, count]) => { const mx = Math.max(...items.map(x => x[1])); return <div key={label} style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}><span style={{ color: '#CCC' }}>{label}</span><span style={{ color, fontWeight: 700 }}>{count}</span></div>
      <div style={{ background: '#1A1A1E', borderRadius: 3, height: 5 }}><div style={{ background: color, height: '100%', borderRadius: 3, width: `${(count / mx) * 100}%` }} /></div>
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
          background:presetAtivo===k?ACCENT+'22':'transparent', color:presetAtivo===k?ACCENT:'#888',
          borderColor:presetAtivo===k?ACCENT:'#2A2A30',
        }}>{l}</button>
      )}
      <span style={{ fontSize: 11, color: '#666', display:'flex', alignItems:'center', marginLeft:8 }}>{d.totalOS.toLocaleString()} OS no período</span>
    </div>

    {/* Tabs */}
    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
      {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        ...S.btnS, padding: '8px 14px', minHeight: 36, fontSize: 11, fontWeight: 600,
        background: tab === t.key ? ACCENT + '20' : 'transparent', color: tab === t.key ? ACCENT : '#888',
        borderColor: tab === t.key ? ACCENT : '#2A2A30',
      }}>{vp.isMobile ? t.short : t.label}</button>)}
    </div>

    {/* ── TAB: KPIs GERAIS ── */}
    {tab === 'kpis' && <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPI label="MTTR" value={`${d.mttr.toFixed(1)}h`} accent="#3B82F6" sub="Tempo Médio de Reparo" small={vp.isMobile} />
        <KPI label="MTBF" value={`${d.mtbf.toFixed(0)}h`} accent="#22C55E" sub="Tempo Médio Entre Falhas" small={vp.isMobile} />
        <KPI label="T. Atendimento" value={`${d.mtAtt.toFixed(0)}min`} accent="#F59E0B" sub="Abertura → Início" small={vp.isMobile} />
        <KPI label="Disponibilidade" value={`${d.disponibilidade.toFixed(1)}%`} accent={d.disponibilidade > 90 ? '#22C55E' : '#EF4444'} sub="Uptime" small={vp.isMobile} />
        <KPI label="Total OS" value={d.totalOS.toLocaleString()} accent="#888" sub={`${d.totalConcluidas} concluídas`} small={vp.isMobile} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        <div style={S.card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>🔧 OS por Tipo de Falha</h3>
          <Bar items={d.falhaMap} color={ACCENT} />
        </div>
        <div style={S.card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>📋 OS por Tipo de Manutenção</h3>
          <Bar items={d.tipoMap} color="#3B82F6" />
        </div>
        <div style={S.card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>🏭 OS por Área</h3>
          <Bar items={d.areaMap} color="#22C55E" />
        </div>
        <div style={S.card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>⏱️ Controle de Horas Mecânicos</h3>
          {d.mecanicos.map(mec => {
            const hhD = d.hhPorMec.find(h => h.nome === mec.nome)
            const osD = d.osPorMec.find(o => o.nome === mec.nome)
            const usado = hhD ? hhD.horas : (osD ? osD.tempoTotal / 60 : 0)
            const pct = d.horasDisponiveis > 0 ? Math.min(100, (usado / d.horasDisponiveis) * 100) : 0
            const cor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#22C55E'
            return <div key={mec.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: '#CCC' }}>{mec.nome}</span>
                <span style={{ color: cor, fontWeight: 700 }}>{usado.toFixed(0)}h / {d.horasDisponiveis}h ({pct.toFixed(0)}%)</span>
              </div>
              <div style={{ background: '#1A1A1E', borderRadius: 3, height: 6 }}><div style={{ background: cor, height: '100%', borderRadius: 3, width: `${pct}%` }} /></div>
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
      </div>
      <div style={S.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>🏆 Ranking de Paradas por Equipamento</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={S.th}>#</th><th style={S.th}>Equipamento</th><th style={S.th}>Cód.</th><th style={S.th}>OS</th><th style={S.th}>Tempo Total</th><th style={S.th}>T. Médio</th><th style={S.th}>Principal Falha</th>
            </tr></thead>
            <tbody>{d.topEquip.slice(0, 30).map((e, i) => {
              const topF = Object.entries(e.falhas).sort((a, b) => b[1] - a[1])[0]
              return <tr key={i}>
                <td style={{ ...S.td, color: i < 3 ? '#EF4444' : '#888', fontWeight: 700 }}>{i + 1}º</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{e.nome}</td>
                <td style={{ ...S.td, color: ACCENT, fontSize: 11 }}>{e.codigo || '—'}</td>
                <td style={{ ...S.td, fontWeight: 700, color: e.total > 50 ? '#EF4444' : e.total > 20 ? '#F59E0B' : '#E5E5E5' }}>{e.total}</td>
                <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{fmtHrs(e.tempoTotal)}</td>
                <td style={{ ...S.td, fontSize: 11, color: '#3B82F6' }}>{e.total > 0 ? Math.round(e.tempoTotal / e.total) : 0}min</td>
                <td style={{ ...S.td, fontSize: 11 }}>{topF ? <span>{topF[0]} <span style={{ color: '#666' }}>({topF[1]}x)</span></span> : '—'}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </div>
    </>}

    {/* ── TAB: MECÂNICOS ── */}
    {tab === 'mecanicos' && <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <KPI label="Horas Disp." value={`${d.horasDisponiveis}h`} accent="#A855F7" sub="Por mecânico" small={vp.isMobile} />
      </div>
      <div style={S.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>👨‍🔧 Hora-Homem por Mecânico</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={S.th}>Mecânico</th><th style={S.th}>OS Atendidas</th><th style={S.th}>Horas Totais</th><th style={S.th}>T. Médio/OS</th><th style={S.th}>Ocupação</th>
            </tr></thead>
            <tbody>{d.osPorMec.filter(m => m.nome !== 'Não atribuído').slice(0, 20).map(m => {
              const hhD = d.hhPorMec.find(h => h.nome === m.nome)
              const hrs = hhD ? hhD.horas : m.tempoTotal / 60
              const pct = d.horasDisponiveis > 0 ? Math.min(100, hrs / d.horasDisponiveis * 100) : 0
              const cor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#22C55E'
              return <tr key={m.nome}>
                <td style={{ ...S.td, fontWeight: 600 }}>{m.nome}</td>
                <td style={{ ...S.td, fontWeight: 700, color: ACCENT }}>{m.total}</td>
                <td style={{ ...S.td, color: '#3B82F6' }}>{hrs.toFixed(1)}h</td>
                <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{m.tempoMedio.toFixed(0)}min</td>
                <td style={S.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ background: '#1A1A1E', borderRadius: 3, height: 6, flex: 1 }}><div style={{ background: cor, height: '100%', borderRadius: 3, width: `${pct}%` }} /></div>
                    <span style={{ fontSize: 10, color: cor, fontWeight: 700, minWidth: 35 }}>{pct.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </div>
    </>}

    {/* ── TAB: SUGESTÕES PREVENTIVA ── */}
    {tab === 'sugestoes' && <>
      <div style={{ ...S.card, borderLeft: '3px solid #F59E0B', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, color: '#F59E0B', fontWeight: 700 }}>💡 Análise para Plano de Manutenção Preventiva</h3>
        <p style={{ fontSize: 12, color: '#CCC', lineHeight: 1.6, margin: 0 }}>
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
                <td style={{ ...S.td, fontWeight: 700, color: s.totalOS > 50 ? '#EF4444' : s.totalOS > 20 ? '#F59E0B' : '#E5E5E5' }}>{s.totalOS}</td>
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
    data.filter(p => p.data_programada && p.ativo !== false).forEach(p => {
      const d = p.data_programada.substring(0, 10)
      if (!map[d]) map[d] = []
      map[d].push(p)
    })
    return map
  }, [data])

  const prevMonth = () => { const [y, m] = mesAtual.split('-').map(Number); const d = new Date(y, m - 2, 1); setMesAtual(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const nextMonth = () => { const [y, m] = mesAtual.split('-').map(Number); const d = new Date(y, m, 1); setMesAtual(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const mesNome = new Date(mesAtual + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const vencidos = data.filter(p => p.ativo !== false && p.data_programada && new Date(p.data_programada) < new Date())
  const proximos = data.filter(p => p.ativo !== false && p.data_programada && new Date(p.data_programada) >= new Date()).slice(0, 10)

  if (loading) return <Loading />

  return <div>
    <Header title="MANUTENÇÃO PREVENTIVA" action={novo} label="+ NOVO PLANO" mobile={vp.isMobile} />

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
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 9, color: '#666', padding: 3, fontWeight: 600 }}>{d}</div>)}
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={`p${i}`} />
            const dateStr = `${mesAtual}-${String(day).padStart(2, '0')}`
            const plans = planByDate[dateStr] || []
            const isToday = dateStr === new Date().toISOString().split('T')[0]
            const isPast = new Date(dateStr) < new Date() && !isToday
            return <div key={i} style={{
              background: plans.length > 0 ? (isPast ? '#3B1F1F' : '#1E3A5F') : '#1A1A1E',
              border: isToday ? `2px solid ${ACCENT}` : '1px solid #1F1F23',
              borderRadius: 4, padding: 4, minHeight: vp.isMobile ? 36 : 56, cursor: plans.length > 0 ? 'pointer' : 'default',
            }} onClick={() => plans.length > 0 && (setItem(plans[0]), setModal('editar'))}>
              <div style={{ fontSize: 11, color: isToday ? ACCENT : '#888', fontWeight: isToday ? 700 : 400 }}>{day}</div>
              {plans.slice(0, 2).map(p => <div key={p.id} style={{ fontSize: 8, color: isPast ? '#EF4444' : '#3B82F6', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🔧 {(p.descricao || '').substring(0, 12)}
              </div>)}
              {plans.length > 2 && <div style={{ fontSize: 8, color: '#666' }}>+{plans.length - 2}</div>}
            </div>
          })}
        </div>
      </div>
    ) : (
      <>
        {/* Vencidos */}
        {vencidos.length > 0 && <div style={{ ...S.card, borderLeft: '3px solid #EF4444', marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 11, color: '#EF4444', textTransform: 'uppercase' }}>⚠️ Planos Vencidos ({vencidos.length})</h3>
          {vencidos.slice(0, 10).map(p => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1A1A1E', cursor: 'pointer' }} onClick={() => { setItem({ ...p }); setModal('editar') }}>
            <div><div style={{ fontSize: 12, fontWeight: 600, color: '#E5E5E5' }}>{p.descricao}</div><div style={{ fontSize: 10, color: '#EF4444' }}>Vencido em {fmtDate(p.data_programada)}</div></div>
            <span style={badge('#EF4444')}>{p.periodicidade}</span>
          </div>)}
        </div>}

        {/* Próximos */}
        <div style={S.card}>
          <h3 style={{ margin: '0 0 10px', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>📅 Próximos Planos</h3>
          {proximos.length === 0 ? <Empty icon="📅" msg="Nenhum plano programado" action="Criar Plano" onAction={novo} /> :
            proximos.map(p => {
              const eq = equipamentos.find(e => e.id === p.equipamento_id)
              return <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1A1A1E', cursor: 'pointer' }} onClick={() => { setItem({ ...p }); setModal('editar') }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#E5E5E5' }}>{p.descricao}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{eq ? `⚙️ ${eq.nome}` : ''} · {fmtDate(p.data_programada)}</div>
                </div>
                <span style={badge('#3B82F6')}>{p.periodicidade}</span>
              </div>
            })}
        </div>

        {/* Todos */}
        <div style={S.card}>
          <h3 style={{ margin: '0 0 10px', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Todos os Planos ({data.filter(p => p.ativo !== false).length})</h3>
          {data.filter(p => p.ativo !== false).map(p => {
            const venc = p.data_programada && new Date(p.data_programada) < new Date()
            return <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1A1A1E', cursor: 'pointer' }} onClick={() => { setItem({ ...p }); setModal('editar') }}>
              <span style={{ fontSize: 11, color: venc ? '#EF4444' : '#CCC' }}>{p.descricao}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#888' }}>{fmtDate(p.data_programada)}</span>
                <span style={badge(venc ? '#EF4444' : '#3B82F6')}>{p.periodicidade}</span>
              </div>
            </div>
          })}
        </div>
      </>
    )}

    <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'NOVO PLANO PREVENTIVO' : 'EDITAR PLANO'} mobile={vp.isMobile}>
      {item && <div>
        <Field label="Descrição" req><input style={S.input} value={item.descricao || ''} onChange={e => setItem({ ...item, descricao: e.target.value })} placeholder="Ex: Lubrificação mensal cardas" /></Field>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #1F1F23', gap: 10, flexWrap: 'wrap' }}>
          {modal === 'editar' && <button style={S.btnD} onClick={async () => { await remove(item.id); setModal(null) }}>Excluir</button>}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}><button style={S.btnS} onClick={() => setModal(null)}>Cancelar</button><button style={S.btnP} onClick={salvar}>Salvar</button></div>
        </div>
      </div>}
    </Modal>
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
          background: tab === k ? ACCENT + '20' : 'transparent', color: tab === k ? ACCENT : '#888', borderColor: tab === k ? ACCENT : '#2A2A30',
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
          return <div key={pk} style={{ background: '#141416', border: '1px solid #1F1F23', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>{pc.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: pc.cor }}>{cnt}</div>
              <div style={{ fontSize: 9, color: '#666' }}>{pc.label}</div>
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
            <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{u.email}</td>
            <td style={S.td}><span style={{ ...badge(pc.cor), display: 'inline-flex', gap: 4, alignItems: 'center' }}>{pc.icon} {pc.label}</span></td>
            <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{areas.find(a => a.id === u.area_id)?.nome || 'Todas'}</td>
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
                  <div style={{ fontSize: 11, color: '#888' }}>Nível {pc.nivel} · {cnt} usuário{cnt !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <span style={{ ...badge(pc.cor), fontSize: 10 }}>Nível {pc.nivel}</span>
            </div>

            <div style={{ fontSize: 12, color: '#CCC', marginBottom: 12, lineHeight: 1.5 }}>{pc.descricao}</div>

            {/* Pages access */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Telas com Acesso</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['dashboard', 'ordens', 'equipamentos', 'mecanicos', 'pecas', 'areas', 'preventiva', 'relatorios', 'usuarios'].map(pg => {
                  const has = pc.paginas.includes(pg)
                  return <span key={pg} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 4,
                    background: has ? pc.cor + '20' : '#1A1A1E', color: has ? pc.cor : '#333',
                    border: `1px solid ${has ? pc.cor + '40' : '#1F1F23'}`,
                  }}>{pg}</span>
                })}
              </div>
            </div>

            {/* Permissions grid */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Permissões</div>
              <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 3 }}>
                {Object.entries(PERM_LABELS).map(([key, label]) => {
                  const has = pc.permissoes[key]
                  return <div key={key} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, display: 'flex', gap: 4, alignItems: 'center', background: has ? '#14532D20' : 'transparent' }}>
                    <span style={{ color: has ? '#22C55E' : '#333' }}>{has ? '✓' : '✕'}</span>
                    <span style={{ color: has ? '#CCC' : '#444' }}>{label}</span>
                  </div>
                })}
              </div>
            </div>

            {/* Users with this profile */}
            {usersOfProfile.length > 0 && <div>
              <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Usuários ({usersOfProfile.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {usersOfProfile.map(u => <span key={u.id} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6, background: '#1A1A1E', border: '1px solid #2A2A30',
                  color: u.ativo ? '#CCC' : '#555', textDecoration: u.ativo ? 'none' : 'line-through',
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
        {item.perfil && <div style={{ background: '#1A1A1E', borderRadius: 8, padding: 12, marginTop: 10, borderLeft: `3px solid ${getPerfil(item.perfil).cor}` }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>{getPerfil(item.perfil).icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: getPerfil(item.perfil).cor }}>{getPerfil(item.perfil).label}</span>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{getPerfil(item.perfil).descricao}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {getPerfil(item.perfil).paginas.map(pg => <span key={pg} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: getPerfil(item.perfil).cor + '20', color: getPerfil(item.perfil).cor }}>{pg}</span>)}
          </div>
        </div>}

        <Field label="Status"><label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44 }}>
          <input type="checkbox" checked={item.ativo !== false} onChange={e => setItem({ ...item, ativo: e.target.checked })} style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 13, color: item.ativo !== false ? '#22C55E' : '#EF4444' }}>{item.ativo !== false ? 'Ativo' : 'Inativo'}</span>
        </label></Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #1F1F23', gap: 10, flexWrap: 'wrap' }}>
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
      <div style={{ fontSize: 12, color: '#CCC', lineHeight: 1.6 }}>
        Catálogo de descrições padronizadas para abertura de OS. O solicitante seleciona uma descrição pronta ao abrir uma OS, garantindo padronização e facilitando análises.
      </div>
    </div>

    {/* Stats */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ background: '#141416', border: '1px solid #1F1F23', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
        <span style={{ color: '#888' }}>Total: </span><strong style={{ color: ACCENT }}>{data.length}</strong>
      </div>
      <div style={{ background: '#141416', border: '1px solid #1F1F23', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
        <span style={{ color: '#888' }}>Categorias: </span><strong style={{ color: '#E5E5E5' }}>{categorias.length}</strong>
      </div>
      <div style={{ background: '#141416', border: '1px solid #1F1F23', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
        <span style={{ color: '#888' }}>Ativas: </span><strong style={{ color: '#22C55E' }}>{data.filter(d => d.ativo !== false).length}</strong>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
      <Search value={search} onChange={setSearch} ph="Buscar descrição..." />
      <select style={{ ...S.select, width: 180 }} value={fCat} onChange={e => setFCat(e.target.value)}>
        <option value="TODOS">Todas Categorias</option>
        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <span style={{ fontSize: 10, color: '#555' }}>{filtered.length} itens</span>
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
              <span style={{ ...badge(catColors[cat] || '#888'), fontSize: 11, fontWeight: 700 }}>{cat}</span>
              <span style={{ fontSize: 10, color: '#555' }}>{items.length} itens</span>
            </div>
            {items.map(d => <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1A1A1E', cursor: 'pointer' }} onClick={() => { setItem({ ...d }); setModal('editar') }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: d.ativo !== false ? '#E5E5E5' : '#555', fontSize: 13, textDecoration: d.ativo === false ? 'line-through' : 'none' }}>{d.descricao}</span>
                {d.ativo === false && <span style={badge('#EF4444')}>Inativa</span>}
              </div>
              <button style={{ ...S.btnS, padding: '3px 8px', minHeight: 26, fontSize: 10 }}>✏️</button>
            </div>)}
          </div>
        })
      ) : (
        filtered.map(d => <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1A1A1E', cursor: 'pointer' }} onClick={() => { setItem({ ...d }); setModal('editar') }}>
          <span style={{ color: d.ativo !== false ? '#E5E5E5' : '#555', fontSize: 13 }}>{d.descricao}</span>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #1F1F23', gap: 10, flexWrap: 'wrap' }}>
          {modal === 'editar' && <button style={S.btnD} onClick={async () => { await remove(item.id); setModal(null) }}>Excluir</button>}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}><button style={S.btnS} onClick={() => setModal(null)}>Cancelar</button><button style={S.btnP} onClick={salvar}>Salvar</button></div>
        </div>
      </div>}
    </Modal>
  </div>
}
