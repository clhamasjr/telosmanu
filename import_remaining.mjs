import MDBReader from 'mdb-reader';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pbwozmqlzvqpjyhwtfji.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBid296bXFsenZxcGp5aHd0ZmppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mzg1MDYsImV4cCI6MjA4OTAxNDUwNn0.rzfG7rZelZ0Q53tpdrZfC6xKQwr8VHKDTdMdjGHKqOU';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const buf = readFileSync('C:/Users/clham/OneDrive/Desktop/sofmancmmsxls.mdb');
const reader = new MDBReader(buf);
function getData(t) { return reader.getTable(t).getData(); }

async function fetchAll(table, select = '*', filter = null) {
  let all = [], page = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (filter) q = filter(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function batchInsert(table, rows, chunkSize = 100) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      // Try one by one
      for (const row of chunk) {
        const { error: e2 } = await supabase.from(table).insert(row);
        if (!e2) inserted++;
      }
    } else {
      inserted += chunk.length;
    }
    if (i % 1000 === 0 && i > 0) process.stdout.write(`  ... ${i}/${rows.length}\n`);
  }
  return inserted;
}

async function run() {
  console.log('=== IMPORTAÇÃO COMPLEMENTAR ===\n');

  // ─── Build maps ───
  const osAll = await fetchAll('ordens_servico', 'id,id_ordem_legado');
  const osMap = {}; osAll.forEach(o => { if (o.id_ordem_legado) osMap[o.id_ordem_legado] = o.id; });
  console.log(`OS no Supabase: ${osAll.length}`);

  const { data: allMec } = await supabase.from('mecanicos').select('id,nome');
  const mecNameMap = {}; (allMec || []).forEach(m => { mecNameMap[m.nome?.toUpperCase()] = m.id; });

  // ─── 1. APONTAMENTOS FALTANTES ───
  console.log('\n1. Verificando apontamentos faltantes...');
  const hhSofman = getData('sofman_cmms_xls_apontamentohh');

  // Get all existing apontamentos ordem_servico_ids
  const existingHH = await fetchAll('apontamento_hh', 'ordem_servico_id');
  const hhOsIds = new Set(existingHH.map(h => h.ordem_servico_id));

  // Get count per OS to detect missing
  const hhCountByOS = {};
  existingHH.forEach(h => { hhCountByOS[h.ordem_servico_id] = (hhCountByOS[h.ordem_servico_id] || 0) + 1; });

  // Count SOFMAN HH by id_ordem_servico
  const sofmanHHByOS = {};
  hhSofman.forEach(h => { sofmanHHByOS[h.id_ordem_servico] = (sofmanHHByOS[h.id_ordem_servico] || 0) + 1; });

  // Find OS IDs where SOFMAN has more apontamentos than Supabase
  const missingHH = [];
  for (const h of hhSofman) {
    const supaOsId = osMap[h.id_ordem_servico];
    if (!supaOsId) continue; // OS not in Supabase

    // We'll just try to insert all and let duplicates fail
    const tempoMin = Math.round((parseFloat(h.tempo_hh) || 0) * 60);
    missingHH.push({
      ordem_servico_id: supaOsId,
      mecanico_id: mecNameMap[h.mantenedor?.toUpperCase()] || null,
      observacoes: h.descricao_execucao || null,
      data_inicio: h.data_inicio || null,
      data_fim: h.data_fim || null,
      tempo_minutos: tempoMin,
      custo_hh: parseFloat(h.custo_hh) || 0,
    });
  }

  // Delete all existing apontamentos and re-insert clean
  console.log(`  SOFMAN total: ${hhSofman.length}, Supabase atual: ${existingHH.length}`);
  console.log(`  Estratégia: limpar e reimportar todos ${missingHH.length} apontamentos`);

  // Delete all
  let deleted = 0;
  while (true) {
    const { data: batch } = await supabase.from('apontamento_hh').select('id').limit(1000);
    if (!batch || batch.length === 0) break;
    const ids = batch.map(b => b.id);
    await supabase.from('apontamento_hh').delete().in('id', ids);
    deleted += ids.length;
    if (deleted % 5000 === 0) process.stdout.write(`  Deletados: ${deleted}\n`);
  }
  console.log(`  ✓ ${deleted} apontamentos antigos removidos`);

  // Insert all fresh
  const ins = await batchInsert('apontamento_hh', missingHH);
  console.log(`  ✓ ${ins} apontamentos inseridos`);

  // ─── 2. PLANEJAMENTO PREVENTIVO ───
  console.log('\n2. Planejamento de Manutenção...');
  const planSofman = getData('sofman_cmms_xls_planejamento_manutencao');

  // Build equip map
  const eqAll = await fetchAll('equipamentos', 'id,id_equipamento_legado');
  const eqMap = {}; eqAll.forEach(e => { if (e.id_equipamento_legado) eqMap[e.id_equipamento_legado] = e.id; });

  const { data: tmAll } = await supabase.from('tipos_manutencao').select('id,nome');
  const tmMap = {}; (tmAll || []).forEach(t => { tmMap[t.nome?.toUpperCase()] = t.id; });

  const planRows = planSofman.map(p => ({
    descricao: p.descricao || null,
    equipamento_id: eqMap[p.id_equipamento] || null,
    tipo_manutencao_id: tmMap[p.tipo_manutencao?.toUpperCase()] || null,
    periodicidade: p.periodicidade || null,
    ativo: true,
    id_planejamento_legado: p.id,
  }));

  // Clear existing planejamento
  const { data: existPlan } = await supabase.from('planejamento_manutencao').select('id');
  if (existPlan?.length) {
    for (const ep of existPlan) {
      await supabase.from('planejamento_manutencao').delete().eq('id', ep.id);
    }
  }

  if (planRows.length) {
    const ins2 = await batchInsert('planejamento_manutencao', planRows);
    console.log(`  ✓ ${ins2} planos inseridos`);
  }

  // ─── 3. TAREFAS PLANEJAMENTO ───
  console.log('\n3. Tarefas do Planejamento...');
  const tpSofman = getData('sofman_cmms_xls_tarefas_planejamento_manutencao');

  // Reload planejamento map
  const planAll = await fetchAll('planejamento_manutencao', 'id,id_planejamento_legado');
  const planMap = {}; planAll.forEach(p => { if (p.id_planejamento_legado) planMap[p.id_planejamento_legado] = p.id; });

  const { data: tarAll } = await supabase.from('tarefas_padrao').select('id,id_tarefa_legado');
  const tarMap = {}; (tarAll || []).forEach(t => { if (t.id_tarefa_legado) tarMap[t.id_tarefa_legado] = t.id; });

  const tpRows = tpSofman.filter(tp => planMap[tp.id_planejamento]).map(tp => ({
    planejamento_id: planMap[tp.id_planejamento],
    tarefa_padrao_id: tarMap[tp.id_tarefa] || null,
    descricao: tp.descricao || null,
    sequencia: tp.sequencia || 1,
  }));

  if (tpRows.length) {
    const ins3 = await batchInsert('planejamento_tarefas', tpRows);
    console.log(`  ✓ ${ins3} tarefas de planejamento inseridas`);
  }

  console.log('\n=== IMPORTAÇÃO COMPLEMENTAR CONCLUÍDA ===');
}

run().catch(err => console.error('ERRO FATAL:', err));
