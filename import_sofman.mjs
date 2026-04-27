import MDBReader from 'mdb-reader';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pbwozmqlzvqpjyhwtfji.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBid296bXFsenZxcGp5aHd0ZmppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mzg1MDYsImV4cCI6MjA4OTAxNDUwNn0.rzfG7rZelZ0Q53tpdrZfC6xKQwr8VHKDTdMdjGHKqOU';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const buf = readFileSync('C:/Users/clham/OneDrive/Desktop/sofmancmmsxls.mdb');
const reader = new MDBReader(buf);

function getData(tableName) {
  return reader.getTable(tableName).getData();
}

// Helper: batch insert in chunks
async function batchInsert(table, rows, chunkSize = 500) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`  ERRO em ${table} (chunk ${i}):`, error.message);
      // Try one by one for this chunk
      for (const row of chunk) {
        const { error: e2 } = await supabase.from(table).insert(row);
        if (!e2) inserted++;
      }
    } else {
      inserted += chunk.length;
    }
  }
  return inserted;
}

// Helper: fetch all existing records with legacy id
async function fetchExisting(table, legacyField) {
  let all = [], page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(`id,${legacyField}`).not(legacyField, 'is', null).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function run() {
  console.log('=== IMPORTAÇÃO SOFMAN → SUPABASE ===\n');

  // ─── 1. CENTROS DE CUSTO ───
  console.log('1. Centros de Custo...');
  const ccSofman = getData('sofman_cmms_xls_cad_centro_custo');
  const { data: ccExist } = await supabase.from('centros_custo').select('id,codigo');
  const ccExistCodes = new Set((ccExist || []).map(c => c.codigo));
  const ccNew = ccSofman.filter(c => !ccExistCodes.has(String(c.codigo))).map(c => ({
    codigo: String(c.codigo), nome: c.descricao, ativo: true
  }));
  if (ccNew.length) {
    const ins = await batchInsert('centros_custo', ccNew);
    console.log(`  ✓ ${ins} centros de custo inseridos`);
  } else console.log('  → Nenhum novo');

  // ─── 2. FORNECEDORES ───
  console.log('2. Fornecedores...');
  const fornSofman = getData('sofman_cmms_xls_cad_fornecedores');
  const { data: fornExist } = await supabase.from('fornecedores').select('id,cnpj,id_fornecedor_legado');
  const fornExistIds = new Set((fornExist || []).map(f => f.id_fornecedor_legado));
  const fornNew = fornSofman.filter(f => !fornExistIds.has(f.id)).map(f => ({
    razao_social: f.razao_social, cnpj: f.cnpj, ativo: true, id_fornecedor_legado: f.id
  }));
  if (fornNew.length) {
    const ins = await batchInsert('fornecedores', fornNew);
    console.log(`  ✓ ${ins} fornecedores inseridos`);
  } else console.log('  → Nenhum novo');

  // ─── 3. FAMÍLIAS DE EQUIPAMENTO ───
  console.log('3. Famílias de Equipamento...');
  const famSofman = getData('sofman_cmms_xls_cad_familias_equipamento');
  const { data: famExist } = await supabase.from('familias_equipamento').select('id,nome');
  const famExistNames = new Set((famExist || []).map(f => f.nome?.toUpperCase()));
  const famNew = famSofman.filter(f => !famExistNames.has(f.descricao?.toUpperCase())).map(f => ({
    nome: f.descricao
  }));
  if (famNew.length) {
    const ins = await batchInsert('familias_equipamento', famNew);
    console.log(`  ✓ ${ins} famílias inseridas`);
  } else console.log('  → Nenhuma nova');

  // ─── 4. TAREFAS PADRÃO ───
  console.log('4. Tarefas Padrão...');
  const tarSofman = getData('sofman_cmms_xls_cad_tarefas');
  const { data: tarExist } = await supabase.from('tarefas_padrao').select('id,id_tarefa_legado');
  const tarExistIds = new Set((tarExist || []).map(t => t.id_tarefa_legado));
  const tarNew = tarSofman.filter(t => !tarExistIds.has(t.id)).map(t => ({
    descricao: t.descricao, id_tarefa_legado: t.id
  }));
  if (tarNew.length) {
    const ins = await batchInsert('tarefas_padrao', tarNew);
    console.log(`  ✓ ${ins} tarefas inseridas`);
  } else console.log('  → Nenhuma nova');

  // ─── 5. MECÂNICOS / MANTENEDORES ───
  console.log('5. Mecânicos (Mantenedores)...');
  const mecSofman = getData('sofman_cmms_xls_cad_mantenedores');
  const mecExist = await fetchExisting('mecanicos', 'id_mantenedor_legado');
  const mecExistIds = new Set(mecExist.map(m => m.id_mantenedor_legado));
  const mecNew = mecSofman.filter(m => !mecExistIds.has(m.id)).map(m => ({
    nome: m.nome, especialidade: m.cargo, custo_hora: parseFloat(m.custo_hora) || 0,
    ativo: true, id_mantenedor_legado: m.id
  }));
  if (mecNew.length) {
    const ins = await batchInsert('mecanicos', mecNew);
    console.log(`  ✓ ${ins} mecânicos inseridos`);
  } else console.log('  → Nenhum novo');

  // ─── 6. EQUIPAMENTOS ───
  console.log('6. Equipamentos...');
  const eqSofman = getData('sofman_cmms_xls_cad_equipamentos');
  const eqExist = await fetchExisting('equipamentos', 'id_equipamento_legado');
  const eqExistIds = new Set(eqExist.map(e => e.id_equipamento_legado));

  // Build lookup maps for familia and area
  const { data: allFam } = await supabase.from('familias_equipamento').select('id,nome');
  const famMap = {}; (allFam || []).forEach(f => { famMap[f.nome?.toUpperCase()] = f.id });
  const { data: allAreas } = await supabase.from('areas').select('id,nome');
  const areaMap = {}; (allAreas || []).forEach(a => { areaMap[a.nome?.toUpperCase()] = a.id });

  // Create areas from locations if they don't exist
  const locations = [...new Set(eqSofman.map(e => e.localizacao).filter(Boolean))];
  const newAreas = locations.filter(loc => !areaMap[loc.toUpperCase()]);
  if (newAreas.length) {
    for (const loc of newAreas) {
      const { data: a } = await supabase.from('areas').insert({ nome: loc, ativo: true }).select('id,nome').single();
      if (a) areaMap[a.nome.toUpperCase()] = a.id;
    }
    console.log(`  ✓ ${newAreas.length} novas áreas criadas a partir de localizações`);
  }

  const eqNew = eqSofman.filter(e => !eqExistIds.has(e.id)).map(e => ({
    codigo: e.identificacao || null,
    nome: e.descricao,
    localizacao: e.complemento || e.localizacao || null,
    area_id: areaMap[e.localizacao?.toUpperCase()] || null,
    familia_id: famMap[e.familia?.toUpperCase()] || null,
    fabricante: e.fabricante || null,
    modelo: e.modelo || null,
    numero_serie: e.n_serie || null,
    status: e.status === 'ATIVO' ? 'Operando' : e.status === 'INATIVO' ? 'Inativo' : 'Operando',
    ativo: e.status !== 'INATIVO',
    id_equipamento_legado: e.id
  }));
  if (eqNew.length) {
    const ins = await batchInsert('equipamentos', eqNew);
    console.log(`  ✓ ${ins} equipamentos inseridos`);
  } else console.log('  → Nenhum novo');

  // ─── 7. MATERIAIS ───
  console.log('7. Materiais...');
  const matSofman = getData('sofman_cmms_xls_cad_materiais');
  const matExist = await fetchExisting('materiais', 'id_material_legado');
  const matExistIds = new Set(matExist.map(m => m.id_material_legado));
  const matNew = matSofman.filter(m => !matExistIds.has(m.id)).map(m => ({
    codigo: m.codigo, nome: m.descricao, unidade: m.unidade || 'UN',
    preco_unitario: parseFloat(m.custo) || 0, localizacao: m.localizacao || null,
    estoque_minimo: m.estoque_min || 0, quantidade: parseFloat(m.saldo_disponivel) || 0,
    ativo: m.status !== 'INATIVO', id_material_legado: m.id
  }));
  if (matNew.length) {
    const ins = await batchInsert('materiais', matNew);
    console.log(`  ✓ ${ins} materiais inseridos`);
  } else console.log('  → Nenhum novo');

  // ─── 8. ORDENS DE SERVIÇO ───
  console.log('8. Ordens de Serviço...');
  const osSofman = getData('sofman_cmms_xls_ordens_servico');
  const osExist = await fetchExisting('ordens_servico', 'id_ordem_legado');
  const osExistIds = new Set(osExist.map(o => o.id_ordem_legado));

  // Build lookup maps
  const { data: allEquip } = await supabase.from('equipamentos').select('id,id_equipamento_legado').not('id_equipamento_legado', 'is', null);
  const eqMap = {}; (allEquip || []).forEach(e => { eqMap[e.id_equipamento_legado] = e.id });

  const { data: allTipoMan } = await supabase.from('tipos_manutencao').select('id,nome');
  const tmMap = {}; (allTipoMan || []).forEach(t => { tmMap[t.nome?.toUpperCase()] = t.id });

  const { data: allStatus } = await supabase.from('status_os').select('id,nome');
  const stMap = {}; (allStatus || []).forEach(s => { stMap[s.nome?.toUpperCase()] = s.id });

  // Map SOFMAN status to Supabase status
  const statusMapping = {
    'ENCERRADO': stMap['CONCLUÍDA'] || stMap['CONCLUIDA'],
    'ABERTO': stMap['ABERTA'],
    'EM ANDAMENTO': stMap['EM ANDAMENTO'],
  };

  // Parse observacoes to extract fields
  function parseObs(obs) {
    const result = {};
    if (!obs) return result;
    const patterns = {
      recebido_por: /RECEBIDO POR:\s*(.+?)(?:\r?\n|$)/i,
      executado_por: /EXECUTADO POR:\s*(.+?)(?:\r?\n|$)/i,
      liberado_por: /LIBERADO POR:\s*(.+?)(?:\r?\n|$)/i,
    };
    for (const [key, regex] of Object.entries(patterns)) {
      const match = obs.match(regex);
      if (match && match[1].trim()) result[key] = match[1].trim();
    }
    return result;
  }

  const osNew = osSofman.filter(o => !osExistIds.has(o.id)).map(o => {
    const parsed = parseObs(o.observacoes);
    return {
      numero_ordem_legado: String(o.ordem_servico),
      titulo: (o.equipamento || '').substring(0, 100),
      descricao: o.descricao_solicitacao || null,
      descricao_execucao: o.descricao_execucao || null,
      observacoes: o.observacoes || null,
      solicitante: o.solicitante || null,
      equipamento_id: eqMap[o.id_equipamento] || null,
      tipo_manutencao_id: tmMap[o.tipo_manutencao?.toUpperCase()] || null,
      status_id: statusMapping[o.status?.toUpperCase()] || statusMapping['ENCERRADO'],
      area_id: areaMap[o.localizacao?.toUpperCase()] || null,
      data_abertura: o.data_programada || o.data_emisao || null,
      data_conclusao: o.status === 'ENCERRADO' ? (o.data_emisao || null) : null,
      tempo_maquina_parada_min: parseInt(o.tempo_maq_parada) || 0,
      recebido_por: parsed.recebido_por || null,
      executado_por: parsed.executado_por || null,
      liberado_por: parsed.liberado_por || null,
      id_ordem_legado: o.id,
    };
  });

  console.log(`  Novas OSs para inserir: ${osNew.length}`);
  if (osNew.length) {
    const ins = await batchInsert('ordens_servico', osNew, 200);
    console.log(`  ✓ ${ins} ordens inseridas`);
  }

  // ─── 9. APONTAMENTOS HH ───
  console.log('9. Apontamentos HH...');
  // Reload OS map with all records
  const allOSData = await fetchExisting('ordens_servico', 'id_ordem_legado');
  const osMap = {}; allOSData.forEach(o => { osMap[o.id_ordem_legado] = o.id });

  // Reload mecânicos map
  const { data: allMec } = await supabase.from('mecanicos').select('id,nome,id_mantenedor_legado');
  const mecNameMap = {}; (allMec || []).forEach(m => { mecNameMap[m.nome?.toUpperCase()] = m.id });

  const hhSofman = getData('sofman_cmms_xls_apontamentohh');

  // Check existing apontamentos count
  const { count: hhCount } = await supabase.from('apontamento_hh').select('id', { count: 'exact', head: true });
  console.log(`  Existentes no Supabase: ${hhCount}`);
  console.log(`  No SOFMAN: ${hhSofman.length}`);

  // We need to check which are already imported. Since apontamento_hh doesn't have id_legado,
  // we'll skip if counts match or insert only for new OS IDs
  const existingOsIds = new Set(osExist.map(o => o.id_ordem_legado));
  const hhNew = hhSofman.filter(h => {
    // Only import apontamentos for newly imported OS
    return !existingOsIds.has(h.id_ordem_servico) && osMap[h.id_ordem_servico];
  }).map(h => {
    const tempoMin = Math.round((parseFloat(h.tempo_hh) || 0) * 60);
    return {
      ordem_servico_id: osMap[h.id_ordem_servico],
      mecanico_id: mecNameMap[h.mantenedor?.toUpperCase()] || null,
      observacoes: h.descricao_execucao || null,
      data_inicio: h.data_inicio || null,
      data_fim: h.data_fim || null,
      tempo_minutos: tempoMin,
      custo_hh: parseFloat(h.custo_hh) || 0,
    };
  });

  console.log(`  Novos apontamentos: ${hhNew.length}`);
  if (hhNew.length) {
    const ins = await batchInsert('apontamento_hh', hhNew, 200);
    console.log(`  ✓ ${ins} apontamentos inseridos`);
  }

  // ─── 10. PLANEJAMENTO DE MANUTENÇÃO ───
  console.log('10. Planejamento de Manutenção...');
  const planSofman = getData('sofman_cmms_xls_planejamento_manutencao');
  const { data: planExist } = await supabase.from('planejamento_manutencao').select('id,id_planejamento_legado');
  const planExistIds = new Set((planExist || []).map(p => p.id_planejamento_legado));
  const planNew = planSofman.filter(p => !planExistIds.has(p.id)).map(p => ({
    descricao: p.descricao || null,
    equipamento_id: eqMap[p.id_equipamento] || null,
    tipo_manutencao_id: tmMap[p.tipo_manutencao?.toUpperCase()] || null,
    periodicidade: p.periodicidade || null,
    ativo: true,
    id_planejamento_legado: p.id,
  }));
  if (planNew.length) {
    const ins = await batchInsert('planejamento_manutencao', planNew);
    console.log(`  ✓ ${ins} planos inseridos`);
  } else console.log('  → Nenhum novo');

  console.log('\n=== IMPORTAÇÃO CONCLUÍDA ===');
}

run().catch(err => console.error('ERRO FATAL:', err));
