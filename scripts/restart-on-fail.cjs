const { spawn } = require('node:child_process');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/restart-on-fail.cjs <command> [...args]');
  process.exit(1);
}

let child = null;
let stopping = false;

const start = () => {
  const [command, ...commandArgs] = args;
  const executable = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : command;
  const executableArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', [command, ...commandArgs].join(' ')]
    : commandArgs;

  child = spawn(executable, executableArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk) => process.stderr.write(chunk));

  child.on('exit', (code, signal) => {
    child = null;
    if (stopping) return;

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.warn(`[restart-on-fail] Child exited with ${reason}. Restarting in 1s...`);
    setTimeout(start, 1000);
  });
};

const stop = () => {
  stopping = true;
  if (child && !child.killed) {
    child.kill('SIGTERM');
  }
  process.exit(0);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

start();
