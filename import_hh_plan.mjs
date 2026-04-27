import MDBReader from 'mdb-reader';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pbwozmqlzvqpjyhwtfji.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBid296bXFsenZxcGp5aHd0ZmppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mzg1MDYsImV4cCI6MjA4OTAxNDUwNn0.rzfG7rZelZ0Q53tpdrZfC6xKQwr8VHKDTdMdjGHKqOU';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const buf = readFileSync('C:/Users/clham/OneDrive/Desktop/sofmancmmsxls.mdb');
const reader = new MDBReader(buf);
function getData(t) { return reader.getTable(t).getData(); }

async function fetchAll(table, select) {
  let all = [], page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++; if (page > 50) break;
  }
  return all;
}

async function batchInsert(table, rows, chunkSize = 100) {
  let inserted = 0, errors = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      for (const row of chunk) {
        const { error: e2 } = await supabase.from(table).insert(row);
        if (!e2) inserted++; else errors++;
      }
    } else {
      inserted += chunk.length;
    }
    if ((i + chunkSize) % 2000 < chunkSize) process.stdout.write(`  ${i + chunk.length}/${rows.length} inseridos...\n`);
  }
  if (errors) console.log(`  (${errors} erros ignorados)`);
  return inserted;
}

async function run() {
  console.log('=== IMPORT: APONTAMENTOS + PLANEJAMENTO ===\n');

  // Build OS map
  const osAll = await fetchAll('ordens_servico', 'id,id_ordem_legado');
  const osMap = {}; osAll.forEach(o => { if (o.id_ordem_legado) osMap[o.id_ordem_legado] = o.id; });
  console.log(`OS mapeadas: ${Object.keys(osMap).length}`);

  // Build mecanicos map
  const { data: allMec } = await supabase.from('mecanicos').select('id,nome');
  const mecMap = {}; (allMec || []).forEach(m => { mecMap[m.nome?.toUpperCase()] = m.id; });

  // ─── APONTAMENTOS ───
  console.log('\n1. Apontamentos HH...');
  const hhSofman = getData('sofman_cmms_xls_apontamentohh');
  const hhRows = [];
  let skipped = 0;
  for (const h of hhSofman) {
    const osId = osMap[h.id_ordem_servico];
    if (!osId) { skipped++; continue; }
    const tempoMin = Math.round((parseFloat(h.tempo_hh) || 0) * 60);
    hhRows.push({
      ordem_servico_id: osId,
      mecanico_id: mecMap[h.mantenedor?.toUpperCase()] || null,
      observacoes: h.descricao_execucao || null,
      data_inicio: h.data_inicio || null,
      data_fim: h.data_fim || null,
      tempo_minutos: tempoMin,
      custo_hh: parseFloat(h.custo_hh) || 0,
    });
  }
  console.log(`  Total SOFMAN: ${hhSofman.length}, mapeados: ${hhRows.length}, sem OS: ${skipped}`);
  const ins1 = await batchInsert('apontamento_hh', hhRows);
  console.log(`  ✓ ${ins1} apontamentos inseridos`);

  // ─── PLANEJAMENTO ───
  console.log('\n2. Planejamento Preventivo...');
  const planSofman = getData('sofman_cmms_xls_planejamento_manutencao');

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
  const ins2 = await batchInsert('planejamento_manutencao', planRows);
  console.log(`  ✓ ${ins2} planos inseridos`);

  // ─── TAREFAS DO PLANEJAMENTO ───
  console.log('\n3. Tarefas do Planejamento...');
  const tpSofman = getData('sofman_cmms_xls_tarefas_planejamento_manutencao');

  const planAll2 = await fetchAll('planejamento_manutencao', 'id,id_planejamento_legado');
  const planMap = {}; planAll2.forEach(p => { if (p.id_planejamento_legado) planMap[p.id_planejamento_legado] = p.id; });

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
    console.log(`  ✓ ${ins3} tarefas inseridas`);
  } else {
    console.log('  → Nenhuma tarefa mapeada');
  }

  console.log('\n=== CONCLUÍDO ===');
}

run().catch(err => console.error('ERRO:', err));
