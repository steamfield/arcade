import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ROOT } from './games.ts';

/**
 * docs/repo-map.md is how agents find files without searching, so it must
 * match the disk: every source file in the shared code and templates is
 * listed, and every path it names exists.
 */

const MAP = 'docs/repo-map.md';
const PREFIXES = ['packages/', 'tools/', 'apps/', 'templates/', 'docs/', '.claude/', '.github/', 'games/'];

/** Folders whose every non-test file must appear in the map, as globs of <dir>/<sub>. */
const MUST_LIST = [
  ['packages', 'src'],
  ['tools', 'src'],
  ['apps', 'src'],
  ['templates', 'src'],
  ['templates', 'scenarios'],
] as const;

function backtickedPaths(markdown: string): string[] {
  const paths = new Set<string>();
  for (const [, token] of markdown.matchAll(/`([^`\s]+)`/g)) {
    if (!token) continue;
    // Placeholders (<slug>) and globs (*) describe patterns, not files.
    if (/[<>*|]/.test(token)) continue;
    if (PREFIXES.some((p) => token.startsWith(p))) paths.add(token.replace(/\/$/, ''));
  }
  return [...paths];
}

function filesThatMustBeListed(): string[] {
  const out: string[] = [];
  for (const [top, sub] of MUST_LIST) {
    const topDir = join(ROOT, top);
    if (!existsSync(topDir)) continue;
    for (const name of readdirSync(topDir)) {
      const dir = join(topDir, name, sub);
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
        const rel = `${top}/${name}/${sub}/${file}`;
        if (!/\.(ts|css)$/.test(rel)) continue;
        if (/\.test\.ts$/.test(rel) && !rel.endsWith('repo-map.test.ts')) continue;
        out.push(rel);
      }
    }
  }
  return out.sort();
}

describe('docs/repo-map.md', () => {
  const map = readFileSync(join(ROOT, MAP), 'utf8');

  test('every path it names exists', () => {
    const missing = backtickedPaths(map).filter((p) => !existsSync(join(ROOT, p)));
    expect(missing, `${MAP} names paths that don't exist. Update or remove these rows`).toEqual([]);
  });

  test('every shared and template source file is listed', () => {
    const listed = new Set(backtickedPaths(map));
    const unlisted = filesThatMustBeListed().filter((f) => !listed.has(f));
    expect(unlisted, `Add a row for each of these to ${MAP} saying what the file is`).toEqual([]);
  });
});
