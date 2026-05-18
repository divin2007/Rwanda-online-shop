const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('rmf_bulk_product_template.xlsx');
let output = '';

output += 'Sheet Names: ' + JSON.stringify(wb.SheetNames) + '\n';
wb.SheetNames.forEach(function(name) {
  const ws = wb.Sheets[name];
  const ref = ws['!ref'] || 'A1';
  output += '\n=== SHEET: ' + name + ' | ref: ' + ref + ' ===\n';
  const json = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  json.forEach(function(row, i) {
    output += 'Row ' + i + ': ' + JSON.stringify(row) + '\n';
  });
  if (ws['!merges']) {
    output += 'MERGES: ' + JSON.stringify(ws['!merges']) + '\n';
  }
  if (ws['!cols']) {
    output += 'COLS: ' + JSON.stringify(ws['!cols']) + '\n';
  }
});

fs.writeFileSync('xlsx-output.txt', output);
console.log('Done writing xlsx-output.txt');
