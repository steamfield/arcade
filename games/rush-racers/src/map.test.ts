/**
 * MAP.md matches the folders on disk: every folder under `src/` has a row in its table, and every
 * folder the table lists exists. Reads the source tree, since the rule is about where code lives.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const GAME_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** A folder path relative to the game root, with a trailing slash, such as `src/engine/worlds/reef/`. */
type Folder = string;

/** `dir` (relative to the game root) and every folder below it. */
function foldersUnder(dir: Folder): Folder[] {
  const children = readdirSync(join(GAME_ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => foldersUnder(`${dir}${entry.name}/`));
  return [dir, ...children];
}

/**
 * The folders MAP.md's table lists: each backticked path ending in `/` in a row's first cell. A
 * placeholder such as `<id>` stands for any one folder name.
 */
function listedFolders(markdown: string): Folder[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .flatMap((line) => {
      const firstCell = line.split('|')[1] ?? '';
      return [...firstCell.matchAll(/`([^`]+\/)`/g)].map(([, folder = '']) => folder);
    });
}

/** A pattern matching exactly the folders `listed` stands for. */
function folderPattern(listed: Folder): RegExp {
  const parts = listed.split(/<[^>]+>/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${parts.join('[^/]+')}$`);
}

const LISTED = listedFolders(readFileSync(join(GAME_ROOT, 'MAP.md'), 'utf8'));
const PATTERNS = LISTED.map((listed) => ({ listed, pattern: folderPattern(listed) }));
const SOURCE_FOLDERS = foldersUnder('src/');

/** True when `listed` names at least one folder on disk. */
function exists(listed: Folder, pattern: RegExp): boolean {
  if (!listed.includes('<'))
    return existsSync(join(GAME_ROOT, listed)) && statSync(join(GAME_ROOT, listed)).isDirectory();
  return SOURCE_FOLDERS.some((folder) => pattern.test(folder));
}

describe('MAP.md', () => {
  it('lists folders', () => {
    expect(LISTED.length, 'MAP.md has no table rows naming folders').toBeGreaterThan(0);
  });

  it('has a row for every folder under src/', () => {
    const unlisted = SOURCE_FOLDERS.filter((folder) => !PATTERNS.some(({ pattern }) => pattern.test(folder)));
    expect(unlisted, `add a row to games/rush-racers/MAP.md for:\n${unlisted.join('\n')}`).toEqual([]);
  });

  it('lists only folders that exist', () => {
    const missing = PATTERNS.filter(({ listed, pattern }) => !exists(listed, pattern)).map(({ listed }) => listed);
    expect(missing, `MAP.md lists folders that don't exist; remove or fix their rows:\n${missing.join('\n')}`).toEqual(
      [],
    );
  });
});
