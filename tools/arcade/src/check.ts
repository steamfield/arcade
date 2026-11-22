import { findGame, listGames, ROOT } from './games.ts';
import { elapsed, run } from './run.ts';

/**
 * Typecheck, lint and unit tests. With a slug: that game plus every package
 * changed since HEAD and everything that depends on them, so editing a shared
 * package while working on one game still checks the others.
 * Prints one line on success; only the failing output otherwise.
 */
export async function check(slug: string | undefined, options: { all: boolean }): Promise<number> {
  const start = performance.now();
  const filters: string[] = [];
  let scope = 'all packages';
  if (!options.all) {
    const hasCommits = (await run('git', ['rev-parse', '--verify', 'HEAD'])).code === 0;
    if (!hasCommits) {
      // Without a commit there's no way to tell which packages changed, so a slug-only check
      // could pass while a shared package edit breaks another game. Check everything.
      scope = 'all packages (no commit yet to diff against)';
    } else {
      if (slug) filters.push(`--filter=${findGame(slug).pkg}`);
      filters.push('--filter=...[HEAD]');
      scope = slug
        ? `${slug} + packages changed since HEAD and their dependents`
        : 'packages changed since HEAD and their dependents';
    }
  }

  const [lint, tasks] = await Promise.all([
    run('pnpm', ['exec', 'biome', 'check', '.', '--reporter=github', '--colors=off', '--max-diagnostics=100']),
    run('pnpm', ['exec', 'turbo', 'run', 'typecheck', 'test', '--output-logs=errors-only', ...filters]),
  ]);

  const affected = /Packages in scope: (.*)/.exec(tasks.output)?.[1]?.split(', ') ?? [];
  const failures: string[] = [];
  if (lint.code !== 0) failures.push(`── lint (biome) ──\n${formatBiome(lint.output)}`);
  if (tasks.code !== 0) failures.push(`── typecheck/test ──\n${trimTurbo(tasks.output)}`);

  if (failures.length === 0) {
    console.log(`✓ check passed (${scope}: ${affected.length} packages) in ${elapsed(start)}`);
    return 0;
  }
  console.log(failures.join('\n\n'));
  console.log(`\n✗ check failed (${scope}) in ${elapsed(start)}`);
  return 1;
}

/**
 * One line per Biome error as file:line rule: message. Formatting-only and
 * import-order issues collapse into one line, since `pnpm fix` resolves them.
 */
function formatBiome(output: string): string {
  const errors: string[] = [];
  const fixable = new Set<string>();
  for (const line of output.split('\n')) {
    const m = /^::error title=([^,]+),file=([^,]+),line=(\d+)[^:]*::(.*)$/.exec(line);
    if (!m) continue;
    const [, rule, file, lineNo, message] = m as unknown as [string, string, string, string, string];
    const path = file.replace(`${ROOT}/`, '');
    if (rule === 'format' || rule === 'assist/source/organizeImports') fixable.add(path);
    else errors.push(`${path}:${lineNo}  ${rule}  ${message}`);
  }
  if (fixable.size > 0)
    errors.push(
      `${fixable.size} file(s) need formatting or import sorting: run \`pnpm fix\` (${[...fixable].join(', ')})`,
    );
  return errors.length > 0 ? errors.join('\n') : output.trim();
}

/** Keep only the failing tasks' own output, without turbo/pnpm chatter. */
function trimTurbo(output: string): string {
  const noise = [
    /^\s*•/,
    /cache (miss|hit|bypass)/,
    /^\S+:\S+: \$ /,
    /ELIFECYCLE/,
    /^\s*(Tasks|Cached|Time):/,
    /ERROR\s+run failed/,
    /ERROR\s+command .* exited/,
    /^\s*$/,
    /^ RUN /,
    /^Attention:|telemetry|turborepo\.dev/,
  ];
  // Turbo prefixes every line with "pkg:task: ". Group by that instead, and make paths repo-relative.
  const dirs = new Map(listGames().map((g) => [g.pkg, g.dir.replace(`${ROOT}/`, '')]));
  const out: string[] = [];
  let current = '';
  for (const line of output.split('\n')) {
    if (noise.some((re) => re.test(line))) continue;
    const m = /^([^:\s]+):(\w+): ?(.*)$/.exec(line);
    if (!m) {
      out.push(line.replace(`${ROOT}/`, ''));
      continue;
    }
    const [, pkg = '', task = '', rest = ''] = m;
    const header = `${pkg} ${task}`;
    if (header !== current) {
      current = header;
      out.push(`[${header}]${dirs.has(pkg) ? ` (${dirs.get(pkg)})` : ''}`);
    }
    const dir = dirs.get(pkg);
    out.push(dir ? rest.replace(/^(src|tests|scenarios)\//, `${dir}/$1/`) : rest);
  }
  return out
    .filter((l, i, all) => l.trim() !== '' || (all[i - 1] ?? '').trim() !== '')
    .join('\n')
    .trim();
}
