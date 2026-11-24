/**
 * The art seam: a world's or theme's data modules import no pixel rows, so they can be loaded without
 * its art. Under `worlds/` and `themes/`, only an `art.ts` and the files inside a `sprites/` folder
 * may import from a `sprites/` path. Reads the source tree, since the rule is about where code lives.
 * Tests are left out: they check the art itself.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ENGINE = new URL('..', import.meta.url).pathname;

/** The module path in each `from '...'` of a file, covering imports and re-exports. */
const IMPORT_FROM = /from\s+'([^']+)'/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

/** Whether the file at `path` (engine-relative) may import sprites: an `art.ts`, or a file in a `sprites/` folder. */
function mayImportSprites(path: string): boolean {
  return path.endsWith('/art.ts') || path.split('/').includes('sprites');
}

/** Each import in the file at `path` that reaches a `sprites/` path, as "path -> specifier". */
function spriteImports(path: string, text: string): string[] {
  return [...text.matchAll(IMPORT_FROM)].flatMap(([, specifier = '']) =>
    specifier.split('/').includes('sprites') ? [`${path} -> ${specifier}`] : [],
  );
}

const FILES = ['worlds', 'themes'].flatMap((folder) =>
  sourceFiles(join(ENGINE, folder)).map((path) => ({ path: relative(ENGINE, path), text: readFileSync(path, 'utf8') })),
);

describe('the art seam', () => {
  it('scans every world and theme module', () => {
    expect(FILES.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        'worlds/reef/objects.ts',
        'worlds/reef/art.ts',
        'themes/ocean.ts',
        'themes/ocean/art.ts',
      ]),
    );
  });

  it('spots a sprites import and its near misses', () => {
    expect(spriteImports('worlds/reef/objects.ts', "import { REEF_ITEM_SHEETS } from './sprites/items.ts';")).toEqual([
      'worlds/reef/objects.ts -> ./sprites/items.ts',
    ]);
    expect(spriteImports('themes/space.ts', "export { SPACE_SHEETS } from './space/sprites/index.ts';")).toEqual([
      'themes/space.ts -> ./space/sprites/index.ts',
    ]);
    expect(spriteImports('worlds/reef/objects.ts', "import { ReefTex } from './keys.ts';")).toEqual([]);
    expect(spriteImports('worlds/reef/objects.ts', "import { sprite } from './spritesheet.ts';")).toEqual([]);
    expect(mayImportSprites('worlds/reef/art.ts')).toBe(true);
    expect(mayImportSprites('worlds/reef/sprites/icons.ts')).toBe(true);
    expect(mayImportSprites('worlds/drawn-skin.ts')).toBe(false);
  });

  it('lets only art.ts and sprite files import from a sprites/ path', () => {
    const importers = FILES.filter(({ path }) => !mayImportSprites(path)).flatMap(({ path, text }) =>
      spriteImports(path, text),
    );
    expect(importers).toEqual([]);
  });
});
