import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

const COLOR_MAPS = [
  { from: /#ff6b00/gi, to: '#ff6b00' }, // Forest green -> Brand Orange
  { from: /#e05300/gi, to: '#e05300' }, // Deep dark green -> Dark Orange
  { from: /#ea580c/gi, to: '#ea580c' }, // Mid green -> Accent Orange
  { from: /#ffedd5/gi, to: '#ffedd5' }, // Light mint green -> Warm Peach
];

function replaceColors(content: string) {
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

function processDirectory(dir: string, updatedFiles: string[]) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath, updatedFiles);
    } else if (stat.isFile() && /\.(tsx|ts|js|jsx|css)$/.test(file)) {
      if (file === 'design-system.ts') continue;
      
      const content = fs.readFileSync(filePath, 'utf8');
      const { updated, changed } = replaceColors(content);
      if (changed) {
        fs.writeFileSync(filePath, updated, 'utf8');
        updatedFiles.push(filePath);
      }
    }
  }
}

export async function GET() {
  try {
    const updatedFiles: string[] = [];
    processDirectory(SRC_DIR, updatedFiles);
    return NextResponse.json({
      success: true,
      message: 'Migration complete!',
      count: updatedFiles.length,
      files: updatedFiles.map(f => path.relative(process.cwd(), f))
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
