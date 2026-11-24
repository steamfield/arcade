/**
 * The bar matrix is complete: every listed course has a bars file for every character at Hard,
 * Novice and Normal, plus the two Easy files. The bars themselves run in the `difficulty` project;
 * this cheap check runs in `unit`, so a course added without all its files fails `arcade check`.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LISTED_COURSES } from '../../courses/index.ts';
import { CHARACTER_IDS } from '../../types.ts';

const BARS_DIR = fileURLToPath(new URL('..', import.meta.url));
const BAR_SUFFIXES = ['', '-novice', '-normal'];
const EASY_NAMES = ['easy-level', 'easy-toddler'];

/** The file names every listed course needs in the balance folder. */
function expectedBarFiles(): string[] {
  return LISTED_COURSES.flatMap((course) => [
    ...CHARACTER_IDS.flatMap((character) => BAR_SUFFIXES.map((suffix) => `${course.id}-${character}${suffix}.test.ts`)),
    ...EASY_NAMES.map((name) => `${course.id}-${name}.test.ts`),
  ]);
}

describe('the bar matrix', () => {
  it('has a file for every listed course, character and level', () => {
    const present = new Set(readdirSync(BARS_DIR));
    const missing = expectedBarFiles().filter((name) => !present.has(name));
    expect(missing, `missing bar files in src/logic/balance:\n${missing.join('\n')}`).toEqual([]);
  });
});
