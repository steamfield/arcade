/**
 * The seams a new course or medium relies on: only the course registry imports a course file, and
 * generic code never branches on which medium it is. Reads the source tree, since the rule is about
 * where code lives.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

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

  it('never branches on a medium id outside logic/media/', () => {
    const branching = FILES.filter(
      ({ path, text }) => !path.startsWith('logic/media/') && /[!=]==?\s*'swim'|'swim'\s*[!=]==?/.test(text),
    ).map(({ path }) => path);
    expect(branching).toEqual([]);
  });
});
