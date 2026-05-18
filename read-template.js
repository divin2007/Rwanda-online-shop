const XLSX = require('xlsx');
const wb = XLSX.readFile('rmf_bulk_product_template.xlsx');
console.log('Sheet Names:', JSON.stringify(wb.SheetNames));
wb.SheetNames.forEach(function(name) {
  const ws = wb.Sheets[name];
  const ref = ws['!ref'] || 'A1';
  console.log('\n=== SHEET: ' + name + ' | ref: ' + ref + ' ===');
  const json = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  json.forEach(function(row, i) {
    console.log('R' + i + ': ' + JSON.stringify(row));
  });
  if (ws['!merges']) {
    console.log('MERGES: ' + JSON.stringify(ws['!merges']));
  }
  if (ws['!cols']) {
    console.log('COLS: ' + JSON.stringify(ws['!cols']));
  }
});
