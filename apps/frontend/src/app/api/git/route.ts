import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

function runCommand(cmd: string, cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        code: error ? error.code || 1 : 0
      });
    });
  });
}

export async function GET() {
  // Locate repo root directory (three levels up from apps/frontend/src/app/api/git)
  const repoRoot = path.resolve(process.cwd(), '../..');
  
  const results: any[] = [];
  
  // 1. Git Status Check
  const statusRes = await runCommand('git status', repoRoot);
  results.push({ step: 'status', ...statusRes });
  
  // 2. Git Add
  const addRes = await runCommand('git add .', repoRoot);
  results.push({ step: 'add', ...addRes });
  
  // 3. Git Commit
  const commitMsg = 'Refactor: Recreate Google Stitch high-fidelity premium designs across markets storefronts';
  const commitRes = await runCommand(`git commit -m "${commitMsg}"`, repoRoot);
  results.push({ step: 'commit', ...commitRes });
  
  // 4. Git Push
  const pushRes = await runCommand('git push', repoRoot);
  results.push({ step: 'push', ...pushRes });
  
  const hasErrors = results.some(r => r.code !== 0 && !r.stderr.includes('nothing to commit'));
  
  return NextResponse.json({
    success: !hasErrors,
    message: hasErrors ? 'Git process finished with warnings/errors' : 'Git repository pushed successfully!',
    cwd: repoRoot,
    steps: results
  });
}
