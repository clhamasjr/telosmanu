import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useViewport() {
  const [w, setW] = useState(window.innerWidth)
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  return { width: w, isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 }
}

// Paginated fetch helper
async function fetchAll(table, select = '*', order = 'created_at', ascending = false) {
  let all = [], page = 0
  while (true) {
    const { data: rows } = await supabase.from(table).select(select).order(order, { ascending }).range(page * 1000, (page + 1) * 1000 - 1)
    if (!rows || rows.length === 0) break
    all = all.concat(rows)
    if (rows.length < 1000) break
    page++
    if (page > 50) break
  }
  return all
}

export function useTable(table, opts = {}) {
  const { select = '*', order = 'created_at', ascending = false } = opts
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    const all = await fetchAll(table, select, order, ascending)
    setData(all)
    setLoading(false)
  }, [table, select, order, ascending])
  useEffect(() => { fetch() }, [fetch])
  const insert = async (rec) => { const { data: r, error } = await supabase.from(table).insert(rec).select().single(); if (!error) { setData(p => [r, ...p]); return r } console.error(error); return null }
  const update = async (id, upd) => { const { data: r, error } = await supabase.from(table).update(upd).eq('id', id).select().single(); if (!error) { setData(p => p.map(x => x.id === id ? r : x)); return r } console.error(error); return null }
  const remove = async (id) => { const { error } = await supabase.from(table).delete().eq('id', id); if (!error) setData(p => p.filter(x => x.id !== id)); return !error }
  return { data, loading, refetch: fetch, insert, update, remove }
}

export function useOrdens() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let all = [], page = 0
    while (true) {
      const { data: rows } = await supabase.from('ordens_servico')
        .select('*, areas(id,nome), equipamentos(id,nome,tag,codigo), mecanicos(id,nome), status_os(id,nome,cor,cor_bg,icone), tipos_manutencao(id,nome,cor), tipos_falha(id,nome)')
        .order('data_abertura', { ascending: false })
        .range(page * 1000, (page + 1) * 1000 - 1)
      if (!rows || rows.length === 0) break
      all = all.concat(rows)
      if (rows.length < 1000) break
      page++
      if (page > 30) break
    }
    setData(all)
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
    if (!error && oldSt !== newSt) await supabase.from('os_historico').insert({ ordem_servico_id: id, acao: `Status: ${oldSt || '?'} → ${newSt || '?'}`, usuario: 'Operador' })
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
    (async () => {
      const [a, s, tm, tf, m] = await Promise.all([
        supabase.from('areas').select('*').order('nome'),
        supabase.from('status_os').select('*').order('ordem_exibicao'),
        supabase.from('tipos_manutencao').select('*').order('nome'),
        supabase.from('tipos_falha').select('*').order('nome'),
        supabase.from('mecanicos').select('*').eq('ativo', true).order('nome'),
      ])
      // Load ALL equipamentos with pagination
      const allEquip = await fetchAll('equipamentos', '*', 'nome', true)
      setAreas(a.data || []); setStatusList(s.data || []); setTiposMan(tm.data || [])
      setTiposFalha(tf.data || []); setMecanicos(m.data || []); setEquipamentos(allEquip)
    })()
  }, [])
  return { areas, statusList, tiposMan, tiposFalha, mecanicos, equipamentos }
}

export function useDashboard(dateFilter) {
  const [data, setData] = useState({ kpis: {}, osPorArea: [], osAbertas: [], osAndamento: [], pecasBaixo: [], osRecentes: [], loading: true })
  useEffect(() => {
    (async () => {
      // Get status IDs first
      const { data: statuses } = await supabase.from('status_os').select('id,nome')
      const stMap = {}; (statuses || []).forEach(s => stMap[s.nome] = s.id)

      // Counts (exact, no 1000 limit)
      const countFor = async (statusName) => {
        const sid = stMap[statusName]
        if (!sid) return 0
        const { count } = await supabase.from('ordens_servico').select('id', { count: 'exact', head: true }).eq('status_id', sid)
        return count || 0
      }

      const [abertas, andamento, aguard, concluidas, totalOS, eqCount, mecCount] = await Promise.all([
        countFor('Aberta'), countFor('Em Andamento'), countFor('Aguardando Peca'),
        countFor('Concluida'), 
        supabase.from('ordens_servico').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
        supabase.from('equipamentos').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
        supabase.from('mecanicos').select('id', { count: 'exact', head: true }).eq('ativo', true).then(r => r.count || 0),
      ])

      // OS lists with optional date filter
      let qAbertas = supabase.from('ordens_servico').select('id,titulo,numero_ordem_legado,prioridade,data_abertura,executado_por,areas(nome),equipamentos(nome,codigo),mecanicos(nome),status_os(nome,cor,cor_bg,icone)').eq('status_id', stMap['Aberta']).order('data_abertura', { ascending: false }).limit(50)
      let qAndamento = supabase.from('ordens_servico').select('id,titulo,numero_ordem_legado,prioridade,data_abertura,executado_por,areas(nome),equipamentos(nome,codigo),mecanicos(nome),status_os(nome,cor,cor_bg,icone)').eq('status_id', stMap['Em Andamento']).order('data_abertura', { ascending: false }).limit(50)
      let qRecentes = supabase.from('ordens_servico').select('id,titulo,numero_ordem_legado,prioridade,data_abertura,status_os(nome,cor,cor_bg,icone),areas(nome)').order('data_abertura', { ascending: false }).limit(15)

      if (dateFilter?.from) {
        qAbertas = qAbertas.gte('data_abertura', dateFilter.from + 'T00:00:00')
        qAndamento = qAndamento.gte('data_abertura', dateFilter.from + 'T00:00:00')
        qRecentes = qRecentes.gte('data_abertura', dateFilter.from + 'T00:00:00')
      }
      if (dateFilter?.to) {
        qAbertas = qAbertas.lte('data_abertura', dateFilter.to + 'T23:59:59')
        qAndamento = qAndamento.lte('data_abertura', dateFilter.to + 'T23:59:59')
        qRecentes = qRecentes.lte('data_abertura', dateFilter.to + 'T23:59:59')
      }

      const [resAbertas, resAndamento, resRecentes, resMat] = await Promise.all([
        qAbertas, qAndamento, qRecentes,
        supabase.from('materiais').select('id,nome,codigo,quantidade,estoque_minimo').eq('ativo', true),
      ])

      // OS por area (sample up to 10000)
      const { data: areaOS } = await supabase.from('ordens_servico').select('areas(nome),status_os(nome)').range(0, 9999)
      const activeOS = (areaOS || []).filter(o => !['Concluida', 'Cancelada'].includes(o.status_os?.nome))
      const areaMap = {}
      activeOS.forEach(o => { const a = o.areas?.nome || 'Sem área'; areaMap[a] = (areaMap[a] || 0) + 1 })

      const pecasBaixo = (resMat.data || []).filter(p => p.quantidade <= p.estoque_minimo)

      setData({
        kpis: { abertas, emAndamento: andamento, aguardPeca: aguard, concluidas, totalEquip: eqCount, totalMec: mecCount, totalOS, pecasBaixo: pecasBaixo.length },
        osPorArea: Object.entries(areaMap).sort((a, b) => b[1] - a[1]),
        osAbertas: resAbertas.data || [],
        osAndamento: resAndamento.data || [],
        pecasBaixo,
        osRecentes: resRecentes.data || [],
        loading: false,
      })
    })()
  }, [dateFilter?.from, dateFilter?.to])
  return data
}

export function useRelatorios(periodo) {
  const [data, setData] = useState({ loading: true, mttr: 0, mtbf: 0, hhPorMec: [], osPorMec: [] })
  useEffect(() => {
    (async () => {
      const from = periodo?.from || '2020-01-01'
      const to = periodo?.to || new Date().toISOString().split('T')[0]
      let allOS = [], page = 0
      while (true) {
        const { data: rows } = await supabase.from('ordens_servico')
          .select('id,data_abertura,data_inicio,data_conclusao,tempo_execucao_min,executado_por,custo_hh,equipamentos(id,nome,codigo),areas(nome),status_os(nome),tipos_falha(nome)')
          .gte('data_abertura', from + 'T00:00:00').lte('data_abertura', to + 'T23:59:59')
          .order('data_abertura').range(page * 1000, (page + 1) * 1000 - 1)
        if (!rows || rows.length === 0) break
        allOS = allOS.concat(rows)
        if (rows.length < 1000) break
        page++; if (page > 30) break
      }
      const { data: mecs } = await supabase.from('mecanicos').select('*').eq('ativo', true)
      const { data: hh } = await supabase.from('apontamento_hh').select('*,mecanicos(nome)').gte('data_inicio', from + 'T00:00:00').lte('data_inicio', to + 'T23:59:59')
      const records = allOS
      const repairTimes = records.filter(o => o.data_inicio && o.data_conclusao).map(o => (new Date(o.data_conclusao) - new Date(o.data_inicio)) / 3600000).filter(t => t > 0 && t < 10000)
      const mttr = repairTimes.length > 0 ? repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length : 0
      const eqFails = {}
      records.filter(o => o.data_abertura && o.equipamentos?.id).forEach(o => { if (!eqFails[o.equipamentos.id]) eqFails[o.equipamentos.id] = []; eqFails[o.equipamentos.id].push(new Date(o.data_abertura)) })
      const gaps = []
      Object.values(eqFails).forEach(dates => { dates.sort((a, b) => a - b); for (let i = 1; i < dates.length; i++) { const g = (dates[i] - dates[i - 1]) / 3600000; if (g > 0 && g < 100000) gaps.push(g) } })
      const mtbf = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0
      const mecMap = {}
      records.forEach(o => { const exec = o.executado_por || 'Não atribuído'; if (!mecMap[exec]) mecMap[exec] = { total: 0, tempoTotal: 0, custoTotal: 0 }; mecMap[exec].total++; mecMap[exec].tempoTotal += o.tempo_execucao_min || 0; mecMap[exec].custoTotal += parseFloat(o.custo_hh) || 0 })
      const osPorMec = Object.entries(mecMap).map(([nome, v]) => ({ nome, ...v, tempoMedio: v.total > 0 ? v.tempoTotal / v.total : 0 })).sort((a, b) => b.total - a.total)
      const hhMap = {}; (hh || []).forEach(h => { const nome = h.mecanicos?.nome || '?'; if (!hhMap[nome]) hhMap[nome] = { horas: 0, registros: 0 }; hhMap[nome].horas += (h.tempo_minutos || 0) / 60; hhMap[nome].registros++ })
      const hhPorMec = Object.entries(hhMap).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.horas - a.horas)
      const diasUteis = Math.round((new Date(to) - new Date(from)) / 86400000 * 5 / 7)
      setData({ loading: false, mttr, mtbf, osPorMec, hhPorMec, records, mecanicos: mecs || [], horasDisponiveis: diasUteis * 8 })
    })()
  }, [periodo?.from, periodo?.to])
  return data
}

export function useOSPorMecanico(nome, periodo) {
  const [data, setData] = useState([]); const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!nome) return
    supabase.from('ordens_servico').select('id,titulo,data_abertura,data_conclusao,tempo_execucao_min,custo_hh,executado_por,status_os(nome,cor,icone),areas(nome),equipamentos(nome)')
      .ilike('executado_por', `%${nome}%`).gte('data_abertura', (periodo?.from || '2020-01-01') + 'T00:00:00').lte('data_abertura', (periodo?.to || '2030-01-01') + 'T23:59:59')
      .order('data_abertura', { ascending: false }).limit(500)
      .then(({ data: rows }) => { setData(rows || []); setLoading(false) })
  }, [nome, periodo?.from, periodo?.to])
  return { data, loading }
}
