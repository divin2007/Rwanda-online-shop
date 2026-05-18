const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, 'src');

const COLOR_MAPS = [
  { from: /#1b4332/gi, to: '#ff6b00' }, // Forest green -> Brand Orange
  { from: /#012d1d/gi, to: '#e05300' }, // Deep dark green -> Dark Orange
  { from: /#116c4a/gi, to: '#ea580c' }, // Mid green -> Accent Orange
  { from: /#c1ecd4/gi, to: '#ffedd5' }, // Light mint green -> Warm Peach
];

function replaceColors(content) {
  let updated = content;
  let changed = false;
  for (const map of COLOR_MAPS) {
    if (map.from.test(updated)) {
      updated = updated.replace(map.from, map.to);
      changed = true;
    }
  }
  return { updated, changed };
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (stat.isFile() && /\.(tsx|ts|js|jsx|css)$/.test(file)) {
      if (file === 'design-system.ts') continue;
      
      const content = fs.readFileSync(filePath, 'utf8');
      const { updated, changed } = replaceColors(content);
      if (changed) {
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log(`Updated colors in: ${filePath}`);
      }
    }
  }
}

console.log(`Starting green to orange color migration inside: ${SRC_DIR}`);
processDirectory(SRC_DIR);
console.log('Migration complete!');
