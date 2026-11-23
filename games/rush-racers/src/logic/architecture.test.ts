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
 * switches on it (`case 'reef':`).
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

/** This file, whose examples of branching are the patterns' own test cases. */
const SELF = 'logic/architecture.test.ts';

/** Each file outside `home` (and other than this one) that branches by `pattern`, with its first offending line. */
function branchingOutside(home: readonly string[], pattern: RegExp): string[] {
  const outside = FILES.filter(({ path }) => path !== SELF && !home.some((prefix) => path.startsWith(prefix)));
  return outside.flatMap(({ path, text }) => {
    const line = text.split('\n').findIndex((row) => pattern.test(row));
    return line < 0 ? [] : [`${path}:${line + 1}`];
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
      ['swim', 'run'],
      ['reef', 'thornwood'],
    ]);
    const branches = ["medium === 'run'", "'swim' !== id", "world.id == 'thornwood'", "case 'reef':"];
    expect(branches.filter((line) => !BRANCH_ON_MEDIUM.test(line) && !BRANCH_ON_WORLD.test(line))).toEqual([]);
    const fine = ["medium: 'run',", "const run = 'swim';", "id === 'running'", "case 'reefs':"];
    expect(fine.filter((line) => BRANCH_ON_MEDIUM.test(line) || BRANCH_ON_WORLD.test(line))).toEqual([]);
  });

  it('never branches on a medium id outside logic/media/', () => {
    expect(branchingOutside(['logic/media/'], BRANCH_ON_MEDIUM)).toEqual([]);
  });

  it('never branches on a world id outside the world registries', () => {
    expect(branchingOutside(['logic/worlds/', 'engine/worlds/'], BRANCH_ON_WORLD)).toEqual([]);
  });
});
