const fs = require('fs');
const path = require('path');

const files = [
  'mobile-app/app/product/[productId].tsx',
  'mobile-app/app/(tabs)/seller.tsx',
  'mobile-app/app/(tabs)/cart.tsx'
];

let changedCount = 0;

for (const file of files) {
  const fullPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    continue;
  }
  let text = fs.readFileSync(fullPath, 'utf8');
  const initialLen = text.length;
  // Match the conflict markers and keep ONLY the upstream code ($1)
  const regex = /<<<<<<< Updated upstream\r?\n([\s\S]*?)=======\r?\n[\s\S]*?>>>>>>> Stashed changes(\r?\n)?/g;
  text = text.replace(regex, '$1');
  
  if (text.length !== initialLen) {
    fs.writeFileSync(fullPath, text, 'utf8');
    console.log(`Successfully resolved conflicts in ${file}`);
    changedCount++;
  } else {
    console.log(`No conflicts found in ${file}`);
  }
}

console.log(`Finished fixing ${changedCount} files.`);
