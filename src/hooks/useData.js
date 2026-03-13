import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Generic data fetcher with caching
export function useTable(table, options = {}) {
  const { select = '*', order = 'created_at', ascending = false, filter } = options
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase.from(table).select(select).order(order, { ascending })
    if (filter) query = filter(query)
    const { data: rows, error } = await query
    if (error) console.error(`Error fetching ${table}:`, error.message)
    else setData(rows || [])
    setLoading(false)
  }, [table, select, order, ascending])

  useEffect(() => { fetch() }, [fetch])

  const insert = async (record) => {
    const { data: row, error } = await supabase.from(table).insert(record).select().single()
    if (error) { console.error(error); return null }
    setData(prev => [row, ...prev])
    return row
  }

  const update = async (id, updates) => {
    const { data: row, error } = await supabase.from(table).update(updates).eq('id', id).select().single()
    if (error) { console.error(error); return null }
    setData(prev => prev.map(r => r.id === id ? row : r))
    return row
  }

  const remove = async (id) => {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { console.error(error); return false }
    setData(prev => prev.filter(r => r.id !== id))
    return true
  }

  return { data, loading, refetch: fetch, insert, update, remove }
}

// Ordens de Serviço with full joins
export function useOrdens() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('ordens_servico')
      .select(`
        *,
        areas(id, nome),
        equipamentos(id, nome, tag, codigo),
        mecanicos(id, nome),
        status_os(id, nome, cor, cor_bg, icone),
        tipos_manutencao(id, nome, cor),
        tipos_falha(id, nome)
      `)
      .order('created_at', { ascending: false })
    if (error) console.error('OS fetch error:', error.message)
    else setData(rows || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const insert = async (record) => {
    const { data: row, error } = await supabase.from('ordens_servico').insert(record).select().single()
    if (!error) {
      // Add history entry
      await supabase.from('os_historico').insert({
        ordem_servico_id: row.id, acao: 'OS criada', usuario: 'Operador'
      })
      await fetch()
    }
    return { row, error }
  }

  const update = async (id, updates, oldStatus, newStatus) => {
    const { data: row, error } = await supabase.from('ordens_servico').update(updates).eq('id', id).select().single()
    if (!error) {
      if (oldStatus !== newStatus) {
        await supabase.from('os_historico').insert({
          ordem_servico_id: id,
          acao: `Status alterado: ${oldStatus || '?'} → ${newStatus || '?'}`,
          usuario: 'Operador'
        })
      }
      await fetch()
    }
    return { row, error }
  }

  const remove = async (id) => {
    const { error } = await supabase.from('ordens_servico').delete().eq('id', id)
    if (!error) setData(prev => prev.filter(r => r.id !== id))
    return !error
  }

  return { data, loading, refetch: fetch, insert, update, remove }
}

// OS History
export function useOSHistorico(osId) {
  const [data, setData] = useState([])
  useEffect(() => {
    if (!osId) return
    supabase.from('os_historico').select('*').eq('ordem_servico_id', osId).order('created_at', { ascending: false })
      .then(({ data }) => setData(data || []))
  }, [osId])
  return data
}

// Dashboard KPIs
export function useDashboard() {
  const [kpis, setKpis] = useState({})
  const [osPorArea, setOsPorArea] = useState([])
  const [osRecentes, setOsRecentes] = useState([])
  const [pecasBaixo, setPecasBaixo] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [osRes, areasRes, matRes, eqRes, mecRes] = await Promise.all([
        supabase.from('ordens_servico').select('id, titulo, numero_ordem_legado, prioridade, data_abertura, status_os(nome, cor, cor_bg, icone), areas(nome)').order('created_at', { ascending: false }),
        supabase.from('areas').select('id, nome'),
        supabase.from('materiais').select('id, nome, codigo, quantidade, estoque_minimo').lte('quantidade', 'estoque_minimo').eq('ativo', true),
        supabase.from('equipamentos').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('mecanicos').select('id', { count: 'exact', head: true }).eq('ativo', true),
      ])

      const os = osRes.data || []
      const statusCount = (name) => os.filter(o => o.status_os?.nome === name).length
      const activeOS = os.filter(o => !['Concluida', 'Concluída', 'Cancelada'].includes(o.status_os?.nome))

      setKpis({
        abertas: statusCount('Aberta'),
        emAndamento: statusCount('Em Andamento'),
        aguardPeca: statusCount('Aguardando Peca') + statusCount('Aguardando Peça'),
        concluidas: statusCount('Concluida') + statusCount('Concluída'),
        urgentes: activeOS.filter(o => o.prioridade === 'Urgente').length,
        totalEquip: eqRes.count || 0,
        totalMec: mecRes.count || 0,
        totalOS: os.length,
      })

      // OS por area
      const areaMap = {}
      activeOS.forEach(o => {
        const area = o.areas?.nome || 'Sem área'
        areaMap[area] = (areaMap[area] || 0) + 1
      })
      setOsPorArea(Object.entries(areaMap).sort((a, b) => b[1] - a[1]))

      setOsRecentes(os.slice(0, 10))
      setPecasBaixo(matRes.data || [])
      setLoading(false)
    })()
  }, [])

  return { kpis, osPorArea, osRecentes, pecasBaixo, loading }
}

// Viewport hook
export function useViewport() {
  const [w, setW] = useState(window.innerWidth)
  useEffect(() => {
    const h = () => setW(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return { width: w, isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 }
}

// Lookups (areas, status, tipos for dropdowns)
export function useLookups() {
  const [areas, setAreas] = useState([])
  const [statusList, setStatusList] = useState([])
  const [tiposMan, setTiposMan] = useState([])
  const [tiposFalha, setTiposFalha] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('areas').select('*').order('nome'),
      supabase.from('status_os').select('*').order('ordem_exibicao'),
      supabase.from('tipos_manutencao').select('*').order('nome'),
      supabase.from('tipos_falha').select('*').order('nome'),
    ]).then(([a, s, tm, tf]) => {
      setAreas(a.data || [])
      setStatusList(s.data || [])
      setTiposMan(tm.data || [])
      setTiposFalha(tf.data || [])
    })
  }, [])

  return { areas, statusList, tiposMan, tiposFalha }
}
