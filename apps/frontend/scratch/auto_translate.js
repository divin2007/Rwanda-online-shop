const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const LANG_FILE = path.join(SRC_DIR, 'context', 'LanguageContext.tsx');

// Simple slugify function for keys
function toSnakeCase(str) {
  return str.replace(/[^a-zA-Z0-9 ]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .toLowerCase();
}

const SKIP_FILES = ['LanguageContext.tsx'];

function processFile(filePath) {
    if (!filePath.endsWith('.tsx') || SKIP_FILES.includes(path.basename(filePath))) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    
    // Check if useLanguage is imported
    const hasImport = content.includes('useLanguage');
    
    // Find strings like >Some text<
    // Only capture letters/numbers with some spaces, avoiding pure numbers or symbols
    const regex = />([^<{}]+)</g;
    
    let match;
    const replacements = [];
    
    while ((match = regex.exec(content)) !== null) {
        const fullText = match[1];
        const trimmed = fullText.trim();
        // Ignore empty, short, or obvious non-texts
        if (trimmed.length > 2 && /[a-zA-Z]/.test(trimmed) && !trimmed.includes('=')) {
            const lines = trimmed.split('\n');
            if(lines.length > 1) continue; // Skip multiline for now
            
            const key = toSnakeCase(trimmed);
            if(key.length > 3) {
                replacements.push({
                   original: match[0],
                   text: trimmed,
                   key: key,
                   start: match.index,
                   end: match.index + match[0].length
                });
            }
        }
    }
    
    if (replacements.length > 0) {
        // Reverse order replacement
        for (let i = replacements.length - 1; i >= 0; i--) {
            const r = replacements[i];
            const originalPart = content.substring(r.start, r.end);
            const newPart = originalPart.replace(r.text, `{t('${r.key}')}`);
            content = content.substring(0, r.start) + newPart + content.substring(r.end);
        }
        
        // Add imports if needed
        if (!hasImport) {
            // Need to add import
            const lastImportIdx = content.lastIndexOf('import ');
            if (lastImportIdx !== -1) {
                const endOfLine = content.indexOf('\n', lastImportIdx);
                content = content.substring(0, endOfLine + 1) + 
                          "import { useLanguage } from '@/context/LanguageContext';\n" + 
                          content.substring(endOfLine + 1);
            }
            
            // Add hook call
            // Find component start
            const componentStartMatch = content.match(/export (default )?(async )?function [a-zA-Z0-9_]+\s*\([^)]*\)\s*\{/);
            if (componentStartMatch) {
               const insertIdx = componentStartMatch.index + componentStartMatch[0].length;
               content = content.substring(0, insertIdx) + 
                         "\n  const { t } = useLanguage();" + 
                         content.substring(insertIdx);
            }
        } else {
             // ensure t is destructured if useLanguage is imported but t is not used
             if (!content.includes('const { t }')) {
                 const hookCall = content.match(/const\s+\{\s*[^}]*\s*\}\s*=\s*useLanguage\(\)/);
                 if (hookCall) {
                     // try to add t
                     if (!hookCall[0].includes(' t ')) {
                          content = content.replace(hookCall[0], hookCall[0].replace('{', '{ t, '));
                     }
                 } else {
                     const componentStartMatch = content.match(/export (default )?(async )?function [a-zA-Z0-9_]+\s*\([^)]*\)\s*\{/);
                     if (componentStartMatch) {
                       const insertIdx = componentStartMatch.index + componentStartMatch[0].length;
                       content = content.substring(0, insertIdx) + 
                                 "\n  const { t } = useLanguage();" + 
                                 content.substring(insertIdx);
                     }
                 }
             }
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        return replacements;
    }
    return [];
}

let allReplacements = [];

function walkDir(dir) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath);
        } else {
            const reps = processFile(dirPath);
            if(reps && reps.length > 0) {
                allReplacements = allReplacements.concat(reps);
            }
        }
    });
}

walkDir(SRC_DIR);

// Update LanguageContext.tsx
let langContent = fs.readFileSync(LANG_FILE, 'utf8');
const enStart = langContent.indexOf('en: {');
if (enStart !== -1) {
    // Find where we can insert
    const insertIdx = langContent.indexOf('\n', enStart + 5);
    let newEntries = '';
    
    // Deduplicate
    const uniqueMap = new Map();
    allReplacements.forEach(r => {
        uniqueMap.set(r.key, r.text);
    });
    
    uniqueMap.forEach((text, key) => {
        // check if key already exists
        if (!langContent.includes(`    ${key}:`)) {
            newEntries += `    ${key}: '${text.replace(/'/g, "\\'")}',\n`;
        }
    });
    
    langContent = langContent.substring(0, insertIdx) + '\n' + newEntries + langContent.substring(insertIdx);
    fs.writeFileSync(LANG_FILE, langContent, 'utf8');
}

console.log('Processed all files. Found keys:', allReplacements.length);
