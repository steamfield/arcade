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
 * @throws {UsageError} When a filter names a group the game doesn't define, or a group is malformed.
 */
export async function testGame(slug: string, filters: string[]): Promise<number> {
  const start = performance.now();
  const game = findGame(slug);
  const pkg = readPackageJson(game.dir);
  const expanded = expandGroups(filters, readTestGroups(pkg, slug), slug);
  const relativeFilters = expanded.filters.map((f) => (f.startsWith('-') ? f : toGameRelative(game.dir, f)));
  const args = vitestArgs(relativeFilters, expanded.projects, pkg.scripts?.test);
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

/** A test group bound to a Vitest project: its paths only exist in that project (a slow one, say). */
export interface ProjectGroup {
  project: string;
  paths: readonly string[];
}

/** A game's named test groups: each a list of game-relative paths, or paths bound to a Vitest project. */
export type TestGroups = Readonly<Record<string, readonly string[] | ProjectGroup>>;

interface GamePackageJson {
  scripts?: { test?: string };
  arcade?: { testGroups?: Record<string, unknown> };
}

function readPackageJson(gameDir: string): GamePackageJson {
  return JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8')) as GamePackageJson;
}

/**
 * The game's test groups, checked: a group is an array of paths or `{ project, paths }`.
 *
 * @throws {UsageError} Naming the group when it is neither.
 */
export function readTestGroups(pkg: GamePackageJson, slug: string): TestGroups {
  const raw = pkg.arcade?.testGroups ?? {};
  for (const [name, group] of Object.entries(raw)) {
    if (!isPathList(group) && !isProjectGroup(group)) {
      throw new UsageError(
        `games/${slug}/package.json arcade.testGroups.${name} must be an array of paths or { "project": "<name>", "paths": [...] }.`,
      );
    }
  }
  return raw as TestGroups;
}

function isPathList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isProjectGroup(value: unknown): value is ProjectGroup {
  if (typeof value !== 'object' || value === null) return false;
  const { project, paths } = value as Partial<ProjectGroup>;
  return typeof project === 'string' && project.length > 0 && isPathList(paths);
}

/** Filters with every `@group` replaced, plus the projects that project-bound groups need. */
export interface ExpandedFilters {
  filters: string[];
  projects: string[];
}

/**
 * Replaces each `@<group>` filter with that group's paths, leaving other filters as they are.
 * A group bound to a project also adds its project to `projects`.
 *
 * @throws {UsageError} When a group isn't defined, listing the groups that are.
 */
export function expandGroups(filters: readonly string[], groups: TestGroups, slug: string): ExpandedFilters {
  const projects: string[] = [];
  const expanded = filters.flatMap((filter) => {
    if (!filter.startsWith('@')) return [filter];
    const name = filter.slice(1);
    const group = Object.hasOwn(groups, name) ? groups[name] : undefined;
    if (group === undefined) throw unknownGroup(filter, groups, slug);
    if (isPathList(group)) return [...group];
    if (!projects.includes(group.project)) projects.push(group.project);
    return [...group.paths];
  });
  return { filters: expanded, projects };
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
 * The arguments to give `vitest run` for these filters. Each project a `@group` is bound to is
 * added. When the game's test script runs one project (`vitest run --project unit`), that project
 * is added too, so a folder or an unfiltered run skips the game's slow projects; it is left out
 * when the caller names a project, names a test file (a file already says what to run), or the
 * script names no project. Vitest runs the union of repeated `--project` flags, so `@bars` next to
 * a plain folder runs both.
 */
export function vitestArgs(
  filters: string[],
  groupProjects: readonly string[],
  testScript: string | undefined,
): string[] {
  const projects = groupProjects.flatMap((p) => ['--project', p]);
  const defaultProject = testScript ? /--project[ =](\S+)/.exec(testScript)?.[1] : undefined;
  const callerNamedProject = filters.some((f) => f === '--project' || f.startsWith('--project='));
  const namesTestFile = pathFilters(filters).some((f) => TEST_FILE.test(f));
  if (!defaultProject || callerNamedProject || namesTestFile) return [...filters, ...projects];
  return [...filters, ...projects, '--project', defaultProject];
}

/** The filters that are paths: not options and not the value of `-t`. */
function pathFilters(filters: string[]): string[] {
  return filters.filter((f, i) => !f.startsWith('-') && filters[i - 1] !== '-t');
}
