/**
 * The navigation seam: only a medium reads its own navigation. Generic code asks the medium
 * (`aimFrom`, `nextTile`, `distanceAt`, `steer`) instead of reading `world.nav`, so a medium with a
 * different kind of navigation plugs in without generic code changing. Swim's field walkers
 * (`ai/steer.ts`) take fields as arguments, so no file outside `logic/media/` needs to read nav.
 * Reads the source tree, since the rule is about where code lives. Tests are left out: a medium's
 * own tests inspect its fields.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../..', import.meta.url).pathname;

/** `.nav`, `?.nav`, `['nav']`, a destructured `{ nav }` (or `fields`, the old name). */
const NAV_READ = /(\??\.\s*(nav|fields)\b)|(\[\s*['"](nav|fields)['"]\s*\])|(\{[^{}]*\b(nav|fields)\b[^{}]*\}\s*[=:])/;

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
      ['nav: medium.buildNav(level, broken),', 'const navy = 1;', 'navigate(world)'].filter((line) =>
        NAV_READ.test(line),
      ),
    ).toEqual([]);
  });

  it('lets only media read nav', () => {
    const readers = FILES.filter(({ path }) => !path.startsWith('logic/media/')).flatMap(({ path, text }) =>
      navReads(text).map((line) => `${path}:${line}`),
    );
    expect(readers).toEqual([]);
  });
});
