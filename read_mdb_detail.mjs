import MDBReader from 'mdb-reader';
import { readFileSync, writeFileSync } from 'fs';

const buf = readFileSync('C:/Users/clham/OneDrive/Desktop/sofmancmmsxls.mdb');
const reader = new MDBReader(buf);

function sample(tableName, limit = 3) {
  try {
    const table = reader.getTable(tableName);
    const cols = table.getColumnNames();
    const rows = table.getData().slice(0, limit);
    return { cols, rows, total: table.getData().length };
  } catch (e) {
    return { error: e.message };
  }
}

const tables = [
  'sofman_cmms_xls_ordens_servico',
  'sofman_cmms_xls_apontamentohh',
  'sofman_cmms_xls_cad_equipamentos',
  'sofman_cmms_xls_cad_mantenedores',
  'sofman_cmms_xls_cad_materiais',
  'sofman_cmms_xls_cad_fornecedores',
  'sofman_cmms_xls_cad_centro_custo',
  'sofman_cmms_xls_cad_tarefas',
  'sofman_cmms_xls_cad_familias_equipamento',
  'sofman_cmms_xls_cad_tipos_manutencao',
  'sofman_cmms_xls_planejamento_manutencao',
  'sofman_cmms_xls_tarefas_planejamento_manutencao',
  'sofman_cmms_xls_materiais_ordem_servico',
  'sofman_cmms_xls_entrada_materiais',
  'sofman_cmms_xls_itens_entrada_materiais',
];

const result = {};
for (const t of tables) {
  result[t] = sample(t);
}

writeFileSync('mdb_detail.json', JSON.stringify(result, null, 2));
console.log('Detalhes salvos em mdb_detail.json');
