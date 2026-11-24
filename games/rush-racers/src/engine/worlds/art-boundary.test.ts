/**
 * The art seam: a world's or theme's data modules import no pixel rows, and nothing reaches its art
 * but the boot step that draws it, so phase 6 can load each `art.ts` on its own. Under `worlds/` and
 * `themes/`, only an `art.ts` and the files inside a `sprites/` folder may import from a `sprites/`
 * path. Anywhere in the game, only `worlds/index.ts`, `themes/index.ts` and another `art.ts` may
 * import an `art.ts`. Test code is exempt: test files, files that import Vitest, and files only test
 * code imports (the conformance helpers). Reads the source tree, since the rule is about where code
 * lives.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../themes/index.ts';
import { SKINS } from './index.ts';

const SRC = fileURLToPath(new URL('../..', import.meta.url));

/** The module path of each static import or re-export (`from '...'`), side-effect import and dynamic `import()`. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;

/** Where the sprites rule applies. */
const ART_HOMES = ['engine/worlds/', 'engine/themes/'];

/** The registries, which are the only non-art files that may import an `art.ts`. */
const ART_IMPORTERS = ['engine/worlds/index.ts', 'engine/themes/index.ts'];

interface SourceFile {
  /** Source-relative path, e.g. `engine/worlds/reef/art.ts`. */
  path: string;
  text: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** Every module path `text` imports, in order. */
function specifiers(text: string): string[] {
  return [...text.matchAll(SPECIFIER)].map(([, specifier = '']) => specifier);
}

/** The source-relative path a relative specifier in the file at `path` points at; a package name as it is. */
function targetOf(path: string, specifier: string): string {
  return specifier.startsWith('.') ? relative(SRC, resolve(SRC, dirname(path), specifier)) : specifier;
}

const isArt = (path: string) => path.endsWith('/art.ts');

/**
 * The paths of test code: test files, files that import Vitest, and files every importer of which is
 * test code, so helpers that only tests use count too.
 */
function testCode(files: readonly SourceFile[]): Set<string> {
  const tests = new Set(
    files
      .filter(({ path, text }) => path.endsWith('.test.ts') || specifiers(text).includes('vitest'))
      .map((f) => f.path),
  );
  const importersOf = new Map<string, string[]>();
  for (const { path, text } of files) {
    for (const specifier of specifiers(text)) {
      const target = targetOf(path, specifier);
      importersOf.set(target, [...(importersOf.get(target) ?? []), path]);
    }
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const { path } of files) {
      const importers = importersOf.get(path) ?? [];
      if (tests.has(path) || importers.length === 0 || !importers.every((importer) => tests.has(importer))) continue;
      tests.add(path);
      grew = true;
    }
  }
  return tests;
}

/** Each import in the non-test file at `path` that crosses the art seam, as "path -> specifier". */
function seamBreaks(path: string, text: string): string[] {
  const checksSprites = ART_HOMES.some((home) => path.startsWith(home)) && !isArt(path);
  const maySprites = !checksSprites || path.split('/').includes('sprites');
  const mayArt = isArt(path) || ART_IMPORTERS.includes(path);
  return specifiers(text).flatMap((specifier) => {
    const spriteBreak = !maySprites && specifier.split('/').includes('sprites');
    const artBreak = !mayArt && isArt(targetOf(path, specifier));
    return spriteBreak || artBreak ? [`${path} -> ${specifier}`] : [];
  });
}

const FILES: SourceFile[] = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, 'utf8'),
}));
const TEST_CODE = testCode(FILES);

describe('the art seam', () => {
  it("scans every world's and theme's data module and art", () => {
    const expected = [
      ...Object.keys(SKINS).flatMap((id) => [`engine/worlds/${id}.ts`, `engine/worlds/${id}/art.ts`]),
      ...Object.keys(THEMES).flatMap((id) => [`engine/themes/${id}.ts`, `engine/themes/${id}/art.ts`]),
    ];
    expect(FILES.map(({ path }) => path)).toEqual(expect.arrayContaining(expected));
  });

  it('spots each kind of sprites import in a data module, and lets a near miss through', () => {
    const objects = 'engine/worlds/reef/objects.ts';
    expect(
      [
        "import { REEF_ITEM_SHEETS } from './sprites/items.ts';",
        "import type { ArtSheet } from '../../art/sprites/sheet.ts';",
        "export { SPACE_SHEETS } from './sprites/index.ts';",
        "import './sprites/items.ts';",
        "const items = await import('./sprites/items.ts');",
      ].flatMap((line) => seamBreaks(objects, line)),
    ).toEqual([
      `${objects} -> ./sprites/items.ts`,
      `${objects} -> ../../art/sprites/sheet.ts`,
      `${objects} -> ./sprites/index.ts`,
      `${objects} -> ./sprites/items.ts`,
      `${objects} -> ./sprites/items.ts`,
    ]);
    expect(seamBreaks(objects, "import { sprite } from './spritesheet.ts';")).toEqual([]);
    expect(seamBreaks('engine/worlds/reef/art.ts', "import { X } from './sprites/items.ts';")).toEqual([]);
    expect(seamBreaks('engine/worlds/reef/sprites/icons.ts', "import { X } from './item-rows.ts';")).toEqual([]);
    expect(seamBreaks('engine/scenes/boot.ts', "import { X } from '../worlds/reef/sprites/icons.ts';")).toEqual([]);
  });

  it('spots an art.ts import outside the registries and other art', () => {
    const line = "import { registerArt } from './art.ts';";
    expect(seamBreaks('engine/worlds/reef/objects.ts', line)).toEqual(['engine/worlds/reef/objects.ts -> ./art.ts']);
    expect(seamBreaks('engine/scenes/boot.ts', "import('../themes/sky/art.ts');")).toEqual([
      'engine/scenes/boot.ts -> ../themes/sky/art.ts',
    ]);
    expect(seamBreaks('engine/worlds/index.ts', "import { registerArt } from './reef/art.ts';")).toEqual([]);
    expect(seamBreaks('engine/themes/index.ts', "import { registerArt } from './sky/art.ts';")).toEqual([]);
    expect(seamBreaks('engine/worlds/reef/objects.ts', "import { ART } from '../../art/index.ts';")).toEqual([]);
  });

  it('counts tests, Vitest importers and helpers only tests import as test code', () => {
    expect(
      ['engine/worlds/skins.test.ts', 'engine/worlds/object-conformance.ts', 'engine/worlds/drawn-skin.ts'].filter(
        (path) => !TEST_CODE.has(path),
      ),
    ).toEqual([]);
    expect(['engine/worlds/reef/objects.ts', 'engine/worlds/index.ts'].filter((path) => TEST_CODE.has(path))).toEqual(
      [],
    );
    const helper = { path: 'engine/worlds/helper.ts', text: "import { it } from 'vitest';" };
    const plain = { path: 'engine/worlds/plain.ts', text: "import { SKINS } from './index.ts';" };
    expect([...testCode([helper, plain])]).toEqual([helper.path]);
  });

  it('keeps every non-test import on its side of the seam', () => {
    const breaks = FILES.filter(({ path }) => !TEST_CODE.has(path)).flatMap(({ path, text }) => seamBreaks(path, text));
    expect(breaks).toEqual([]);
  });
});
