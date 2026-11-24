/**
 * The seams a new course, medium or world relies on: only the course registry imports a course file,
 * and generic code never branches on which medium or world it is. Reads the source tree, since the
 * rule is about where code lives.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MEDIA } from './media/index.ts';
import { WORLDS } from './worlds/index.ts';

const SRC = new URL('..', import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

const FILES = sourceFiles(SRC).map((path) => ({ path: relative(SRC, path), text: readFileSync(path, 'utf8') }));
const COURSE_FILES = readdirSync(join(SRC, 'logic/courses'))
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'index.ts' && name !== 'types.ts')
  .map((name) => name.replace(/\.ts$/, ''));

/**
 * A pattern for code that branches on one of `ids`: compares with it (`=== 'swim'`, `'run' !==`) or
 * switches on it (`case 'reef':`). It reads literals only, so a comparison against a constant holding
 * an id, or an object keyed by ids and indexed by one, gets past it; review catches those.
 */
function branchOn(ids: readonly string[]): RegExp {
  const id = `'(?:${ids.join('|')})'`;
  return new RegExp(`[!=]==?\\s*${id}|${id}\\s*[!=]==?|\\bcase\\s+${id}\\s*:`);
}

/** Every shipped medium id and world id, from the registries, so a new one is guarded as soon as it ships. */
const MEDIUM_IDS = Object.keys(MEDIA);
const WORLD_IDS = Object.keys(WORLDS);
const BRANCH_ON_MEDIUM = branchOn(MEDIUM_IDS);
const BRANCH_ON_WORLD = branchOn(WORLD_IDS);

/** A line that is only a comment: `//`, or a `/**` block's opening, middle or closing line. */
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;

/** The 1-based number of the first code line in `text` that branches by `pattern`, or null. Comment lines don't count. */
function firstBranch(text: string, pattern: RegExp): number | null {
  const line = text.split('\n').findIndex((row) => !COMMENT_LINE.test(row) && pattern.test(row));
  return line < 0 ? null : line + 1;
}

/**
 * Each source file outside `home` that branches by `pattern`, with its first offending line. Tests
 * are left out: they may pick a medium or world by id to set up a race.
 */
function branchingOutside(home: readonly string[], pattern: RegExp): string[] {
  const outside = FILES.filter(
    ({ path }) => !path.endsWith('.test.ts') && !home.some((prefix) => path.startsWith(prefix)),
  );
  return outside.flatMap(({ path, text }) => {
    const line = firstBranch(text, pattern);
    return line === null ? [] : [`${path}:${line}`];
  });
}

describe('the course and medium seams', () => {
  it('finds the course files it guards', () => {
    expect(COURSE_FILES).toContain('sunlit-shallows');
  });

  it('lets only the course registry import a course file', () => {
    const importers = FILES.filter(({ path, text }) =>
      COURSE_FILES.some((course) => text.includes(`/${course}.ts'`) && path !== 'logic/courses/index.ts'),
    ).map(({ path }) => path);
    expect(importers).toEqual([]);
  });

  it('guards every shipped medium and world id, and spots each way of branching on one', () => {
    expect([MEDIUM_IDS, WORLD_IDS]).toEqual([
      ['swim', 'run', 'flight', 'drift'],
      ['reef', 'thornwood', 'cloudreach', 'farside'],
    ]);
    const branches = ["medium === 'run'", "'swim' !== id", "world.id == 'thornwood'", "case 'reef':"];
    expect(branches.filter((line) => !BRANCH_ON_MEDIUM.test(line) && !BRANCH_ON_WORLD.test(line))).toEqual([]);
    const fine = ["medium: 'run',", "const run = 'swim';", "id === 'running'", "case 'reefs':"];
    expect(fine.filter((line) => BRANCH_ON_MEDIUM.test(line) || BRANCH_ON_WORLD.test(line))).toEqual([]);
    const comments = ["// only when medium === 'run'", " * the `world.id === 'thornwood'` case", "/** case 'reef': */"];
    expect(comments.map((line) => firstBranch(line, BRANCH_ON_MEDIUM) ?? firstBranch(line, BRANCH_ON_WORLD))).toEqual([
      null,
      null,
      null,
    ]);
    expect(firstBranch("// a note\nif (medium === 'run') {", BRANCH_ON_MEDIUM)).toBe(2);
  });

  it('never branches on a medium id outside logic/media/', () => {
    expect(branchingOutside(['logic/media/'], BRANCH_ON_MEDIUM)).toEqual([]);
  });

  it('never branches on a world id outside the world registries', () => {
    expect(branchingOutside(['logic/worlds/', 'engine/worlds/'], BRANCH_ON_WORLD)).toEqual([]);
  });
});
