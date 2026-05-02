const fs = require('fs');

const files = ['build.sh', 'start.sh'];

files.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`Fixing line endings for ${file}...`);
    const content = fs.readFileSync(file, 'utf8');
    const lfContent = content.replace(/\r\n/g, '\n');
    fs.writeFileSync(file, lfContent, { mode: 0o755 });
  }
});
