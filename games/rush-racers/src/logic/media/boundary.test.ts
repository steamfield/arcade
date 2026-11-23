/**
 * The navigation seam: only a medium reads its own navigation. Generic code asks the medium
 * (`aimFrom`, `nextTile`, `distanceAt`, `steer`) instead of reading `world.nav`, so a medium with a
 * different kind of navigation plugs in without generic code changing. Swim's field walkers
 * (`ai/steer.ts`) take fields as arguments, so only media's own files (MEDIUM_HOMES) read nav.
 * Nor does anything import a medium's own modules (`logic/media/<id>/`) from outside that medium's
 * folder, except the registry (`media/index.ts`), which is the one line each medium is added by.
 * Reads the source tree, since the rule is about where code lives. Tests are left out: a medium's
 * own tests inspect its fields. So is the conformance suite, which hosts the test-only glide.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../..', import.meta.url).pathname;

/** `.nav`, `?.nav`, `['nav']` or a destructured `{ nav }`, and the same reads of `fields`, so navigation can't sit on the world under that name either. */
const NAV_READ = /(\??\.\s*(nav|fields)\b)|(\[\s*['"](nav|fields)['"]\s*\])|(\{[^{}]*\b(nav|fields)\b[^{}]*\}\s*[=:])/;

/** Where media live: the shipped ones, and the conformance suite's test-only glide. */
const MEDIUM_HOMES = ['logic/media/', 'logic/conformance/glide'];

/** Files allowed to import any medium's folder: the registry, and the conformance suite. */
const MEDIUM_IMPORTERS = ['logic/media/index.ts', 'logic/conformance/'];

/** The module path in each `from '...'` of a file. */
const IMPORT_FROM = /from\s+'([^']+)'/g;

/** A source-relative path inside a medium's own folder; the group is the medium's id. */
const MEDIUM_FOLDER = /^logic\/media\/([^/]+)\//;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

/** Each line of `text` that reads nav, as "line: text". */
function navReads(text: string): string[] {
  return text.split('\n').flatMap((line, index) => (NAV_READ.test(line) ? [`${index + 1}: ${line.trim()}`] : []));
}

/**
 * Each relative import in the file at `path` (source-relative) that reaches into a medium's folder
 * the file isn't in, as "path -> target".
 */
function foreignMediumImports(path: string, text: string): string[] {
  return [...text.matchAll(IMPORT_FROM)].flatMap(([, specifier = '']) => {
    if (!specifier.startsWith('.')) return [];
    const target = relative(SRC, resolve(SRC, dirname(path), specifier));
    const id = MEDIUM_FOLDER.exec(target)?.[1];
    if (id === undefined || path.startsWith(`logic/media/${id}/`)) return [];
    return [`${path} -> ${target}`];
  });
}

const FILES = sourceFiles(SRC).map((path) => ({ path: relative(SRC, path), text: readFileSync(path, 'utf8') }));

describe('the navigation seam', () => {
  it('scans the game source', () => {
    expect(FILES.map(({ path }) => path)).toEqual(expect.arrayContaining(['logic/world.ts', 'logic/guide.ts']));
  });

  it('spots each way of reading nav', () => {
    const reads = [
      'world.nav.steer',
      'world?.nav',
      "world['nav']",
      'const { nav, level } = world;',
      'function f({ nav }: World) {}',
      'world.fields.steer',
    ];
    expect(reads.filter((line) => !NAV_READ.test(line))).toEqual([]);
    expect(
      ['nav: medium.buildNav(level, broken, tuning),', 'const navy = 1;', 'navigate(world)'].filter((line) =>
        NAV_READ.test(line),
      ),
    ).toEqual([]);
  });

  it("spots an import of a medium's folder from outside it", () => {
    const flight = "import { lift } from '../flight/lift.ts';";
    expect(foreignMediumImports('logic/media/swim/pilot.ts', flight)).toEqual([
      'logic/media/swim/pilot.ts -> logic/media/flight/lift.ts',
    ]);
    expect(foreignMediumImports('logic/race/coral.ts', "import { swimNav } from '../media/swim/data.ts';")).toEqual([
      'logic/race/coral.ts -> logic/media/swim/data.ts',
    ]);
    expect(foreignMediumImports('logic/media/swim/index.ts', "import { applyIntent } from './physics.ts';")).toEqual(
      [],
    );
    expect(foreignMediumImports('logic/world.ts', "import { mediumOf } from './media/index.ts';")).toEqual([]);
  });

  it("lets nothing outside a medium's folder import from it, but the registry", () => {
    const importers = FILES.filter(({ path }) => !MEDIUM_IMPORTERS.some((allowed) => path.startsWith(allowed))).flatMap(
      ({ path, text }) => foreignMediumImports(path, text),
    );
    expect(importers).toEqual([]);
  });

  it('lets only media, in their own files, read nav', () => {
    const readers = FILES.filter(({ path }) => !MEDIUM_HOMES.some((home) => path.startsWith(home))).flatMap(
      ({ path, text }) => navReads(text).map((line) => `${path}:${line}`),
    );
    expect(readers).toEqual([]);
  });
});
