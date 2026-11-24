import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { findGame, ROOT, UsageError } from './games.ts';
import { elapsed, run } from './run.ts';

/**
 * One game's Vitest suite, optionally narrowed to some files or a name pattern, without the
 * typecheck, lint and dependent packages that `check` adds. Filters may be repo-relative
 * (`games/<slug>/src/logic/race`) or game-relative (`src/logic/race`), or `@<group>` for a named
 * set of paths from the game's package.json (`"arcade": { "testGroups": { ... } }`); `-t <pattern>`
 * passes through, and `--project <name>` picks a Vitest project (see `vitestArgs` for the default).
 * Prints one line on success and Vitest's output on failure.
 *
 * @throws {UsageError} When a filter names a group the game doesn't define.
 */
export async function testGame(slug: string, filters: string[]): Promise<number> {
  const start = performance.now();
  const game = findGame(slug);
  const expanded = expandGroups(filters, readTestGroups(game.dir), slug);
  const relativeFilters = expanded.map((f) => (f.startsWith('-') ? f : toGameRelative(game.dir, f)));
  const args = vitestArgs(relativeFilters, readTestScript(game.dir));
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

/** A game's named test groups: each a list of game-relative paths, or paths bound to a Vitest project. */
export type TestGroups = Readonly<Record<string, readonly string[] | { project: string; paths: readonly string[] }>>;

interface GamePackageJson {
  scripts?: { test?: string };
  arcade?: { testGroups?: TestGroups };
}

function readPackageJson(gameDir: string): GamePackageJson {
  return JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8')) as GamePackageJson;
}

function readTestGroups(gameDir: string): TestGroups {
  return readPackageJson(gameDir).arcade?.testGroups ?? {};
}

function readTestScript(gameDir: string): string | undefined {
  return readPackageJson(gameDir).scripts?.test;
}

/**
 * Replaces each `@<group>` filter with that group's paths, leaving other filters as they are.
 * A group bound to a project also adds `--project <project>` after its paths.
 *
 * @throws {UsageError} When a group isn't defined, listing the groups that are.
 */
export function expandGroups(filters: readonly string[], groups: TestGroups, slug: string): string[] {
  return filters.flatMap((filter) => {
    if (!filter.startsWith('@')) return [filter];
    const name = filter.slice(1);
    const group = Object.hasOwn(groups, name) ? groups[name] : undefined;
    if (group === undefined) throw unknownGroup(filter, groups, slug);
    if ('paths' in group) return [...group.paths, '--project', group.project];
    return [...group];
  });
}

function unknownGroup(filter: string, groups: TestGroups, slug: string): UsageError {
  const known = Object.keys(groups);
  return new UsageError(
    `${slug} has no test group "${filter}". ${
      known.length ? `Its groups: ${known.map((g) => `@${g}`).join(', ')}.` : 'It defines none.'
    } Groups live in its package.json under "arcade": { "testGroups": { ... } }.`,
  );
}

const TEST_FILE = /\.(test|spec)\.ts$/;

/**
 * The arguments to give `vitest run` for these filters. When the game's test script runs one
 * project (`vitest run --project unit`), that project is added at the end so a folder or an
 * unfiltered run skips the game's slow projects. Nothing is added when the caller names a
 * project, names a test file (a file already says what to run), or the script names no project.
 */
export function vitestArgs(filters: string[], testScript: string | undefined): string[] {
  const defaultProject = testScript ? /--project[ =](\S+)/.exec(testScript)?.[1] : undefined;
  if (!defaultProject) return filters;
  if (filters.some((f) => f === '--project' || f.startsWith('--project='))) return filters;
  if (pathFilters(filters).some((f) => TEST_FILE.test(f))) return filters;
  return [...filters, '--project', defaultProject];
}

/** The filters that are paths: not options and not the value of `-t`. */
function pathFilters(filters: string[]): string[] {
  return filters.filter((f, i) => !f.startsWith('-') && filters[i - 1] !== '-t');
}
