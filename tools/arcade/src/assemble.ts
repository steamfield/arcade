import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { type GameInfo, listGames, ROOT, UsageError } from './games.ts';
import { elapsed, run } from './run.ts';

export type Include = 'published' | 'preview' | 'all';

const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Which games go into a build: production gets published, PR previews add drafts, tests add templates. */
export function selectGames(include: Include, only?: string): GameInfo[] {
  const allowed: Record<Include, string[]> = {
    published: ['published'],
    preview: ['published', 'draft'],
    all: ['published', 'draft', 'template'],
  };
  const games = listGames().filter((g) => allowed[include].includes(g.manifest.status));
  if (only) {
    const match = games.filter((g) => g.slug === only);
    if (match.length === 0) throw new UsageError(`"${only}" is not part of a "${include}" build`);
    return match;
  }
  return games;
}

/**
 * What a Cloudflare Workers Builds run ships, from the branch it built (WORKERS_CI_BRANCH).
 * The production branch gets published games; every other branch is a preview that adds drafts.
 */
export function includeForBranch(branch: string | undefined, production = 'main'): Include {
  return !branch || branch === production ? 'published' : 'preview';
}

/** Build the site and the selected games, then copy them into dist/ as the Worker serves it. */
export async function assemble(include: Include, only?: string): Promise<{ ok: boolean; report: string[] }> {
  const start = performance.now();
  const games = selectGames(include, only);
  const filters = ['--filter=@arcade/site', ...games.map((g) => `--filter=${g.pkg}`)];
  const build = await run('pnpm', ['exec', 'turbo', 'run', 'build', '--output-logs=errors-only', ...filters], {
    env: { ARCADE_INCLUDE: include },
  });
  if (build.code !== 0) return { ok: false, report: ['build failed:', build.output.trim()] };

  const out = join(ROOT, 'dist');
  rmSync(out, { recursive: true, force: true });
  cpSync(join(ROOT, 'apps/site/dist'), out, { recursive: true });
  const report: string[] = [];
  let totalFiles = countFiles(out);
  const oversized: string[] = [];
  for (const game of games) {
    const from = join(game.dir, 'dist');
    if (!existsSync(from)) return { ok: false, report: [`${game.slug} has no dist/ after building`] };
    const to = join(out, 'games', game.slug);
    mkdirSync(to, { recursive: true });
    cpSync(from, to, { recursive: true });
    const files = countFiles(to);
    totalFiles += files;
    oversized.push(...walk(to).filter((f) => statSync(f).size > MAX_FILE_BYTES));
    report.push(`  ${game.slug.padEnd(20)} ${String(files).padStart(5)} files  ${mb(dirSize(to))}`);
  }
  writeFileSync(
    join(out, '_headers'),
    [
      '/_v/*',
      '  Cache-Control: public, max-age=31536000, immutable',
      '/games/*/_v/*',
      '  Cache-Control: public, max-age=31536000, immutable',
      '',
    ].join('\n'),
  );
  report.unshift(`assembled ${games.length} games (${include}) into dist/ in ${elapsed(start)}: ${totalFiles} files`);
  const problems: string[] = [];
  if (totalFiles > MAX_FILES * 0.8)
    problems.push(`${totalFiles} files is near Cloudflare's ${MAX_FILES}-file limit. Pack sprites into atlases.`);
  for (const f of oversized) problems.push(`${relative(ROOT, f)} is over Cloudflare's 25 MiB per-file limit.`);
  return { ok: problems.length === 0, report: [...report, ...problems] };
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}
const countFiles = (dir: string) => walk(dir).length;
const dirSize = (dir: string) => walk(dir).reduce((n, f) => n + statSync(f).size, 0);
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
