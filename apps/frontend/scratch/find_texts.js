const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const regex = />\s*([A-Z][a-z0-9A-Z\s.,!?'"-]+[a-zA-Z0-9.,!?])\s*</g;

walkDir('c:/Users/mahor/.gemini/antigravity/scratch/Rwanda-online-shop/apps/frontend/src', function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        const content = fs.readFileSync(filePath, 'utf8');
        let match;
        const matches = [];
        while ((match = regex.exec(content)) !== null) {
            const text = match[1].trim();
            if (text.length > 2 && !text.includes('className') && !text.includes('{') && !text.includes('}')) {
                matches.push(text);
            }
        }
        if (matches.length > 0) {
            console.log(filePath);
            matches.forEach(m => console.log('  ', m));
        }
    }
});
