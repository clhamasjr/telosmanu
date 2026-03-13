import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useViewport() {
  const [w, setW] = useState(window.innerWidth)
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  return { width: w, isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 }
}

export function useTable(table, opts = {}) {
  const { select = '*', order = 'created_at', ascending = false } = opts
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase.from(table).select(select).order(order, { ascending })
    setData(rows || [])
    setLoading(false)
  }, [table, select, order, ascending])
  useEffect(() => { fetch() }, [fetch])
  const insert = async (rec) => { const { data: r, error } = await supabase.from(table).insert(rec).select().single(); if (!error) { setData(p => [r, ...p]); return r } return null }
  const update = async (id, upd) => { const { data: r, error } = await supabase.from(table).update(upd).eq('id', id).select().single(); if (!error) { setData(p => p.map(x => x.id === id ? r : x)); return r } return null }
  const remove = async (id) => { const { error } = await supabase.from(table).delete().eq('id', id); if (!error) setData(p => p.filter(x => x.id !== id)); return !error }
  return { data, loading, refetch: fetch, insert, update, remove }
}

export function useOrdens() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase.from('ordens_servico').select(`*, areas(id,nome), equipamentos(id,nome,tag,codigo), mecanicos(id,nome), status_os(id,nome,cor,cor_bg,icone), tipos_manutencao(id,nome,cor), tipos_falha(id,nome)`).order('created_at', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }, [])
  useEffect(() => { fetch() }, [fetch])
  const insert = async (rec) => {
    const { data: r, error } = await supabase.from('ordens_servico').insert(rec).select().single()
    if (!error) { await supabase.from('os_historico').insert({ ordem_servico_id: r.id, acao: 'OS criada', usuario: 'Operador' }); await fetch() }
    return { row: r, error }
  }
  const update = async (id, upd, oldSt, newSt) => {
    const { data: r, error } = await supabase.from('ordens_servico').update(upd).eq('id', id).select().single()
    if (!error && oldSt !== newSt) await supabase.from('os_historico').insert({ ordem_servico_id: id, acao: `Status: ${oldSt||'?'} → ${newSt||'?'}`, usuario: 'Operador' })
    if (!error) await fetch()
    return { row: r, error }
  }
  const remove = async (id) => { const { error } = await supabase.from('ordens_servico').delete().eq('id', id); if (!error) setData(p => p.filter(r => r.id !== id)); return !error }
  return { data, loading, refetch: fetch, insert, update, remove }
}

export function useOSHistorico(osId) {
  const [data, setData] = useState([])
  useEffect(() => {
    if (!osId) return
    supabase.from('os_historico').select('*').eq('ordem_servico_id', osId).order('created_at', { ascending: false }).then(({ data }) => setData(data || []))
  }, [osId])
  return data
}

export function useLookups() {
  const [areas, setAreas] = useState([])
  const [statusList, setStatusList] = useState([])
  const [tiposMan, setTiposMan] = useState([])
  const [tiposFalha, setTiposFalha] = useState([])
  const [mecanicos, setMecanicos] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  useEffect(() => {
    Promise.all([
      supabase.from('areas').select('*').order('nome'),
      supabase.from('status_os').select('*').order('ordem_exibicao'),
      supabase.from('tipos_manutencao').select('*').order('nome'),
      supabase.from('tipos_falha').select('*').order('nome'),
      supabase.from('mecanicos').select('*').eq('ativo', true).order('nome'),
      supabase.from('equipamentos').select('*').eq('ativo', true).order('nome'),
    ]).then(([a, s, tm, tf, m, e]) => {
      setAreas(a.data || []); setStatusList(s.data || []); setTiposMan(tm.data || [])
      setTiposFalha(tf.data || []); setMecanicos(m.data || []); setEquipamentos(e.data || [])
    })
  }, [])
  return { areas, statusList, tiposMan, tiposFalha, mecanicos, equipamentos }
}

export function useDashboard() {
  const [data, setData] = useState({ kpis: {}, osPorArea: [], osAbertas: [], osAndamento: [], pecasBaixo: [], loading: true })
  useEffect(() => {
    (async () => {
      const [osRes, matRes, eqRes, mecRes] = await Promise.all([
        supabase.from('ordens_servico').select('id, titulo, numero_ordem_legado, prioridade, data_abertura, data_inicio, executado_por, status_os(nome,cor,cor_bg,icone), areas(nome), equipamentos(nome,codigo), mecanicos(nome)').order('created_at', { ascending: false }),
        supabase.from('materiais').select('id,nome,codigo,quantidade,estoque_minimo').eq('ativo', true),
        supabase.from('equipamentos').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('mecanicos').select('id', { count: 'exact', head: true }).eq('ativo', true),
      ])
      const os = osRes.data || []
      const cnt = (n) => os.filter(o => o.status_os?.nome === n).length
      const active = os.filter(o => !['Concluida','Concluída','Cancelada'].includes(o.status_os?.nome))
      const abertas = os.filter(o => o.status_os?.nome === 'Aberta')
      const andamento = os.filter(o => o.status_os?.nome === 'Em Andamento')
      const pecasBaixo = (matRes.data || []).filter(p => p.quantidade <= p.estoque_minimo)

      const areaMap = {}
      active.forEach(o => { const a = o.areas?.nome || 'Sem área'; areaMap[a] = (areaMap[a] || 0) + 1 })

      setData({
        kpis: {
          abertas: cnt('Aberta'), emAndamento: cnt('Em Andamento'),
          aguardPeca: cnt('Aguardando Peca') + cnt('Aguardando Peça'),
          concluidas: cnt('Concluida') + cnt('Concluída'),
          urgentes: active.filter(o => o.prioridade === 'Urgente').length,
          totalEquip: eqRes.count || 0, totalMec: mecRes.count || 0, totalOS: os.length,
          pecasBaixo: pecasBaixo.length,
        },
        osPorArea: Object.entries(areaMap).sort((a, b) => b[1] - a[1]),
        osAbertas: abertas.slice(0, 20),
        osAndamento: andamento.slice(0, 20),
        pecasBaixo,
        osRecentes: os.slice(0, 10),
        loading: false,
      })
    })()
  }, [])
  return data
}

// Relatórios - MTTR, MTBF, HH por mecânico
export function useRelatorios(periodo) {
  const [data, setData] = useState({ loading: true, mttr: 0, mtbf: 0, hhPorMec: [], osPorMec: [] })
  useEffect(() => {
    (async () => {
      const from = periodo?.from || '2020-01-01'
      const to = periodo?.to || new Date().toISOString().split('T')[0]
      const { data: os } = await supabase.from('ordens_servico').select('id, data_abertura, data_inicio, data_conclusao, tempo_execucao_min, executado_por, custo_hh, equipamentos(id,nome,codigo), areas(nome), status_os(nome), tipos_falha(nome)').gte('data_abertura', from + 'T00:00:00').lte('data_abertura', to + 'T23:59:59').order('data_abertura')
      const { data: mecs } = await supabase.from('mecanicos').select('*').eq('ativo', true)
      const { data: hh } = await supabase.from('apontamento_hh').select('*, mecanicos(nome)').gte('data_inicio', from + 'T00:00:00').lte('data_inicio', to + 'T23:59:59')

      const records = os || []
      // MTTR: avg time to repair (conclusao - inicio) in hours
      const repairTimes = records.filter(o => o.data_inicio && o.data_conclusao).map(o => (new Date(o.data_conclusao) - new Date(o.data_inicio)) / 3600000)
      const mttr = repairTimes.length > 0 ? repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length : 0

      // MTBF: avg time between failures per equipment
      const eqFails = {}
      records.filter(o => o.data_abertura && o.equipamentos?.id).forEach(o => {
        if (!eqFails[o.equipamentos.id]) eqFails[o.equipamentos.id] = []
        eqFails[o.equipamentos.id].push(new Date(o.data_abertura))
      })
      const gaps = []
      Object.values(eqFails).forEach(dates => {
        dates.sort((a, b) => a - b)
        for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 3600000)
      })
      const mtbf = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0

      // OS por mecânico
      const mecMap = {}
      records.forEach(o => {
        const exec = o.executado_por || 'Não atribuído'
        if (!mecMap[exec]) mecMap[exec] = { total: 0, tempoTotal: 0, custoTotal: 0 }
        mecMap[exec].total++
        mecMap[exec].tempoTotal += o.tempo_execucao_min || 0
        mecMap[exec].custoTotal += parseFloat(o.custo_hh) || 0
      })
      const osPorMec = Object.entries(mecMap).map(([nome, v]) => ({ nome, ...v, tempoMedio: v.total > 0 ? v.tempoTotal / v.total : 0 })).sort((a, b) => b.total - a.total)

      // HH por mecânico (apontamentos)
      const hhMap = {}
      ;(hh || []).forEach(h => {
        const nome = h.mecanicos?.nome || 'Desconhecido'
        if (!hhMap[nome]) hhMap[nome] = { horas: 0, registros: 0 }
        hhMap[nome].horas += (h.tempo_minutos || 0) / 60
        hhMap[nome].registros++
      })
      const hhPorMec = Object.entries(hhMap).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.horas - a.horas)

      // Horas disponíveis por mecânico (8h/dia útil no período)
      const diasUteis = Math.round((new Date(to) - new Date(from)) / 86400000 * 5 / 7)
      const horasDisp = diasUteis * 8

      setData({
        loading: false, mttr, mtbf, osPorMec, hhPorMec, records,
        mecanicos: mecs || [], horasDisponiveis: horasDisp,
      })
    })()
  }, [periodo?.from, periodo?.to])
  return data
}

// OS por mecânico (para detalhe)
export function useOSPorMecanico(nome, periodo) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!nome) return
    const from = periodo?.from || '2020-01-01'
    const to = periodo?.to || new Date().toISOString().split('T')[0]
    supabase.from('ordens_servico').select('id, titulo, data_abertura, data_conclusao, tempo_execucao_min, custo_hh, executado_por, status_os(nome,cor,icone), areas(nome), equipamentos(nome)')
      .ilike('executado_por', `%${nome}%`)
      .gte('data_abertura', from + 'T00:00:00').lte('data_abertura', to + 'T23:59:59')
      .order('data_abertura', { ascending: false })
      .then(({ data: rows }) => { setData(rows || []); setLoading(false) })
  }, [nome, periodo?.from, periodo?.to])
  return { data, loading }
}

// Equipamentos por área
export function useEquipPorArea(areaId) {
  const [data, setData] = useState([])
  useEffect(() => {
    if (!areaId) { setData([]); return }
    supabase.from('equipamentos').select('*').eq('area_id', areaId).eq('ativo', true).order('nome')
      .then(({ data: rows }) => setData(rows || []))
  }, [areaId])
  return data
}
