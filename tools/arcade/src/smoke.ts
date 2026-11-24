import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { assemble, selectGames } from './assemble.ts';
import { ROOT } from './games.ts';
import { elapsed, run } from './run.ts';

/**
 * Production check: build, assemble everything (templates included), serve it
 * with `wrangler dev` exactly as Cloudflare will (the site Worker and the API
 * Worker it forwards `/api/*` to, in one process), and run each game's
 * Playwright suite against it. This is where wrong base paths, missing assets
 * and Safari-only breakage show up.
 */
export async function smoke(slug: string | undefined): Promise<number> {
  const start = performance.now();
  const assembled = await assemble('all', slug);
  console.log(assembled.report.join('\n'));
  if (!assembled.ok) return 1;

  const port = await freePort();
  const wrangler = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      // The first config is the one served on the port; the API is reached through its service binding.
      ...['--config', 'wrangler.jsonc', '--config', 'apps/api/wrangler.jsonc'],
      ...['--port', String(port), '--ip', '127.0.0.1', '--log-level', 'error'],
    ],
    {
      cwd: ROOT,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      detached: true,
    },
  );
  let wranglerLog = '';
  wrangler.stderr.on('data', (d) => {
    wranglerLog += d;
  });
  const stopWrangler = () => killProcessGroup(wrangler.pid);
  const onSigint = () => {
    stopWrangler();
    process.exit(130);
  };
  const onSigterm = () => {
    stopWrangler();
    process.exit(143);
  };
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  const base = `http://127.0.0.1:${port}`;
  let failed = 0;
  try {
    await waitFor(`${base}/`, 30_000, () => wranglerLog);
    for (const [path, want] of [
      ['/', 200],
      ['/does-not-exist', 404],
    ] as const) {
      const status = (await fetch(`${base}${path}`)).status;
      if (status !== want) {
        console.log(`✗ site ${path} returned ${status}, expected ${want}`);
        failed++;
      }
    }
    for (const game of selectGames('all', slug)) {
      const t = performance.now();
      const res = await run('pnpm', ['exec', 'playwright', 'test', '--reporter=line'], {
        cwd: game.dir,
        env: { ARCADE_BASE_URL: base },
      });
      const summary = /\d+ passed[^\n]*|\d+ failed[^\n]*/g;
      const counts = res.output.match(summary)?.join(', ') ?? 'no result';
      if (res.code === 0) console.log(`✓ ${game.slug}: ${counts} (${elapsed(t)})`);
      else {
        failed++;
        console.log(`✗ ${game.slug}: ${counts} (${elapsed(t)})\n${failureDetail(res.output)}`);
      }
    }
  } finally {
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
    stopWrangler();
  }
  console.log(failed ? `\n✗ smoke failed in ${elapsed(start)}` : `\n✓ smoke passed in ${elapsed(start)}`);
  return failed ? 1 : 0;
}

/** Sends SIGTERM to a detached child's whole process group, so wrangler's workers go with it. */
function killProcessGroup(pid: number | undefined): void {
  try {
    if (pid) process.kill(-pid, 'SIGTERM');
  } catch {
    // The process already exited (it failed to start); the error that says why is the one to show.
  }
}

/** Playwright's failure blocks, minus attachment and trace boilerplate. */
function failureDetail(output: string): string {
  const keep = output
    .split('\n')
    .filter(
      (l) => !/attachment #|────|Usage:|show-trace|^\s*$|test-failed-\d\.png|trace\.zip|error-context\.md/.test(l),
    );
  const firstFailure = keep.findIndex((l) => /^\s+\d+\) /.test(l));
  return keep
    .slice(firstFailure === -1 ? 0 : firstFailure)
    .slice(0, 60)
    .join('\n');
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const a = srv.address();
      srv.close(() => (typeof a === 'object' && a ? resolve(a.port) : reject(new Error('no port'))));
    });
  });
}

async function waitFor(url: string, timeoutMs: number, log: () => string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`wrangler dev did not start within ${timeoutMs / 1000}s:\n${log()}`);
}
