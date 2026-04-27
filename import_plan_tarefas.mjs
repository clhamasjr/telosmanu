import MDBReader from 'mdb-reader';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pbwozmqlzvqpjyhwtfji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBid296bXFsenZxcGp5aHd0ZmppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mzg1MDYsImV4cCI6MjA4OTAxNDUwNn0.rzfG7rZelZ0Q53tpdrZfC6xKQwr8VHKDTdMdjGHKqOU'
);

const buf = readFileSync('C:/Users/clham/OneDrive/Desktop/sofmancmmsxls.mdb');
const reader = new MDBReader(buf);
const tpSofman = reader.getTable('sofman_cmms_xls_tarefas_planejamento_manutencao').getData();

async function run() {
  const { data: plans } = await supabase.from('planejamento_manutencao').select('id,id_planejamento_legado');
  const planMap = {}; (plans || []).forEach(p => { if (p.id_planejamento_legado) planMap[p.id_planejamento_legado] = p.id; });

  const { data: tarefas } = await supabase.from('tarefas_padrao').select('id,id_tarefa_legado');
  const tarMap = {}; (tarefas || []).forEach(t => { if (t.id_tarefa_legado) tarMap[t.id_tarefa_legado] = t.id; });

  const rows = tpSofman.filter(tp => planMap[tp.id_planejamento]).map(tp => ({
    planejamento_id: planMap[tp.id_planejamento],
    tarefa_padrao_id: tarMap[tp.id_tarefa] || null,
    descricao: tp.descricao || null,
    sequencia: tp.sequencia || 1,
  }));

  console.log(`Inserindo ${rows.length} tarefas do planejamento...`);
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('planejamento_tarefas').insert(rows.slice(i, i + 100));
    if (error) console.error('Erro:', error.message);
  }

  const { count } = await supabase.from('planejamento_tarefas').select('id', { count: 'exact', head: true });
  console.log(`✓ ${count} tarefas no banco`);
}

run().catch(console.error);
