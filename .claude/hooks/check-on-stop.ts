// Stop hook: if game or package code changed, run `arcade check --skip-tests` (typecheck and lint;
// AGENTS.md "Test scope" keeps the full suite for whoever merges) before Claude
// reports done. On failure, block the stop once and hand Claude the failure output.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8')) as { stop_hook_active?: boolean };
if (input.stop_hook_active) process.exit(0); // already continued once for this; don't loop

const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout ?? '';
const touched = status.split('\n').some((l) => /\s(games|templates|packages|tools|apps)\//.test(l));
if (!touched) process.exit(0);

const result = spawnSync('pnpm', ['arcade', 'check', '--skip-tests'], { encoding: 'utf8' });
if (result.status === 0) process.exit(0);
const output = `${result.stdout}${result.stderr}`.trim().split('\n').slice(-60).join('\n');
console.log(
  JSON.stringify({
    decision: 'block',
    reason: `pnpm arcade check --skip-tests fails on the current changes. Fix these before finishing:\n${output}`,
  }),
);
