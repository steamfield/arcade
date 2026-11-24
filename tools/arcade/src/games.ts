import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameManifest } from '@arcade/config/manifest';
import { readManifestsIn } from '@arcade/config/manifest-file';

export const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

export interface GameInfo {
  slug: string;
  dir: string;
  /** package.json name, for turbo/pnpm filters. */
  pkg: string;
  manifest: GameManifest;
  kind: 'game' | 'template';
}

/** Every game and template in the repo, read from their game.json files. */
export function listGames(): GameInfo[] {
  const found: GameInfo[] = [];
  for (const [folder, kind] of [
    ['games', 'game'],
    ['templates', 'template'],
  ] as const) {
    for (const { dir, manifest } of readManifestsIn(join(ROOT, folder))) {
      if (!existsSync(join(dir, 'package.json'))) {
        // A half-made or leftover folder shouldn't stop every arcade command.
        console.warn(`arcade: skipping ${folder}/${basename(dir)}: it has game.json but no package.json`);
        continue;
      }
      const pkg = (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name: string }).name;
      found.push({ slug: manifest.slug, dir, pkg, manifest, kind });
    }
  }
  return found.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function findGame(slug: string): GameInfo {
  const games = listGames();
  const game = games.find((g) => g.slug === slug);
  if (!game) {
    throw new UsageError(`No game "${slug}". Known: ${games.map((g) => g.slug).join(', ') || '(none)'}`);
  }
  return game;
}

/** An error whose message is the whole story; the CLI prints it without a stack. */
export class UsageError extends Error {}
