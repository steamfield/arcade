/** Checks the item import boundary across game source, including type imports and re-exports. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const ITEMS = 'logic/items';
const MOVEMENT = new Set(['logic/racer.ts', 'logic/logs.ts', 'logic/bump.ts', 'logic/status.ts']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

it('keeps movement independent of items and routes other callers through the item index', () => {
  const violations = sourceFiles(SRC).flatMap((path) => {
    const importer = relative(SRC, path);
    if (importer.startsWith(`${ITEMS}/`)) return [];
    const imports = readFileSync(path, 'utf8').matchAll(
      /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"](\.{1,2}\/[^'"]+)['"]/g,
    );
    return [...imports].flatMap(([_, specifier]) => {
      if (!specifier) return [];
      const target = relative(SRC, join(path, '..', specifier));
      const entersItems = target === ITEMS || target.startsWith(`${ITEMS}/`);
      const allowed = !MOVEMENT.has(importer) && target === `${ITEMS}/index.ts`;
      return entersItems && !allowed ? [`${importer} → ${specifier}`] : [];
    });
  });
  expect(violations).toEqual([]);
});
