import { relative, resolve } from 'node:path';
import { findGame, ROOT } from './games.ts';
import { elapsed, run } from './run.ts';

/**
 * One game's Vitest suite, optionally narrowed to some files or a name pattern, without the
 * typecheck, lint and dependent packages that `check` adds. Filters may be repo-relative
 * (`games/<slug>/src/logic/race`) or game-relative (`src/logic/race`); `-t <pattern>` passes through.
 * Prints one line on success and Vitest's output on failure.
 */
export async function testGame(slug: string, filters: string[]): Promise<number> {
  const start = performance.now();
  const game = findGame(slug);
  const args = filters.map((f) => (f.startsWith('-') ? f : toGameRelative(game.dir, f)));
  const result = await run('pnpm', ['exec', 'vitest', 'run', ...args], { cwd: game.dir, env: { NO_COLOR: '1' } });
  const scope = filters.length ? `${slug} ${filters.join(' ')}` : slug;
  const counts = /Tests\s+(.+?)\s*\(/.exec(result.output)?.[1] ?? '';
  if (result.code === 0 && /\d+ passed/.test(counts)) {
    console.log(`✓ tests passed (${scope}: ${counts}) in ${elapsed(start)}`);
    return 0;
  }
  // Vitest exits 0 when a name filter skips everything; that is never what the caller meant.
  console.log(
    result.code === 0
      ? `No test ran${counts ? ` (${counts})` : ''}: check the paths and -t pattern.`
      : result.output.trimEnd(),
  );
  console.log(`\n✗ tests failed (${scope}) in ${elapsed(start)}`);
  return 1;
}

/** A repo-relative path inside the game becomes game-relative; anything else is left for Vitest. */
function toGameRelative(gameDir: string, filter: string): string {
  const prefix = `${relative(ROOT, gameDir)}/`;
  if (filter.startsWith(prefix)) return filter.slice(prefix.length);
  const absolute = resolve(ROOT, filter);
  return absolute.startsWith(`${gameDir}/`) ? relative(gameDir, absolute) : filter;
}
