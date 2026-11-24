import { spawn } from 'node:child_process';
import { ROOT } from './games.ts';

export interface RunResult {
  code: number;
  output: string;
}

/** Run a command and capture combined output. Never inherits stdio, so callers decide what the agent sees. */
export function run(cmd: string, args: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
  return new Promise<RunResult>((resolve) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd ?? ROOT,
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: '1', FORCE_COLOR: '0', ...options.env },
    });
    let output = '';
    child.stdout.on('data', (d) => {
      output += d;
    });
    child.stderr.on('data', (d) => {
      output += d;
    });
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
    // A missing binary emits 'error' and may never emit 'close'. A promise settles once, so both firing is safe.
    child.on('error', (err) => resolve({ code: 1, output: `${output}${cmd}: ${err.message}` }));
  });
}

export const elapsed = (start: number) => `${((performance.now() - start) / 1000).toFixed(1)}s`;
