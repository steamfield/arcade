import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { findGame, ROOT, UsageError } from './games.ts';
import { elapsed, run } from './run.ts';

/**
 * One game's Vitest suite, optionally narrowed to some files or a name pattern, without the
 * typecheck, lint and dependent packages that `check` adds. Filters may be repo-relative
 * (`games/<slug>/src/logic/race`) or game-relative (`src/logic/race`), or `@<group>` for a named
 * set of paths from the game's package.json (`"arcade": { "testGroups": { ... } }`); `-t <pattern>`
 * passes through. Prints one line on success and Vitest's output on failure.
 *
 * @throws {UsageError} When a filter names a group the game doesn't define.
 */
export async function testGame(slug: string, filters: string[]): Promise<number> {
  const start = performance.now();
  const game = findGame(slug);
  const expanded = expandGroups(filters, readTestGroups(game.dir), slug);
  const args = expanded.map((f) => (f.startsWith('-') ? f : toGameRelative(game.dir, f)));
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

/** A game's named test groups: each a list of game-relative paths. Empty when it defines none. */
export type TestGroups = Readonly<Record<string, readonly string[]>>;

function readTestGroups(gameDir: string): TestGroups {
  const pkg = JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8')) as {
    arcade?: { testGroups?: TestGroups };
  };
  return pkg.arcade?.testGroups ?? {};
}

/**
 * Replaces each `@<group>` filter with that group's paths, leaving other filters as they are.
 *
 * @throws {UsageError} When a group isn't defined, listing the groups that are.
 */
export function expandGroups(filters: readonly string[], groups: TestGroups, slug: string): string[] {
  return filters.flatMap((filter) => {
    if (!filter.startsWith('@')) return [filter];
    const name = filter.slice(1);
    if (Object.hasOwn(groups, name)) return [...(groups[name] ?? [])];
    const known = Object.keys(groups);
    throw new UsageError(
      `${slug} has no test group "${filter}". ${
        known.length ? `Its groups: ${known.map((g) => `@${g}`).join(', ')}.` : 'It defines none.'
      } Groups live in its package.json under "arcade": { "testGroups": { ... } }.`,
    );
  });
}
