import MDBReader from 'mdb-reader';
import { readFileSync, writeFileSync } from 'fs';

const buf = readFileSync('C:/Users/clham/OneDrive/Desktop/sofmancmmsxls.mdb');
const reader = new MDBReader(buf);

// List all tables
const tables = reader.getTableNames();
console.log('=== TABELAS ===');
console.log(tables.join('\n'));
console.log('\n=== CONTAGEM DE REGISTROS ===');

const summary = {};
for (const t of tables) {
  try {
    const table = reader.getTable(t);
    const count = table.getData().length;
    const cols = table.getColumnNames();
    summary[t] = { count, cols };
    console.log(`${t}: ${count} registros (${cols.length} colunas)`);
  } catch (e) {
    console.log(`${t}: ERRO - ${e.message}`);
  }
}

// Save summary
writeFileSync('mdb_summary.json', JSON.stringify(summary, null, 2));
console.log('\nSummary salvo em mdb_summary.json');
