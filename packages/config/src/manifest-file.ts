/**
 * Reads `game.json` files from disk for Node-side tools (the Vite preset, the Playwright config,
 * the arcade CLI and the landing page build). Kept apart from `manifest.ts` so browser code that
 * imports the schema never pulls in `node:fs`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type GameManifest, parseManifest } from './manifest.ts';

/**
 * The parsed `game.json` in a game or template folder.
 *
 * @throws {Error} When the file is missing, isn't JSON, or fails the schema (the message names the path).
 */
export function readManifest(gameDir: string): GameManifest {
  const path = join(gameDir, 'game.json');
  return parseManifest(JSON.parse(readFileSync(path, 'utf8')), path);
}

/** A folder under `games/` or `templates/` that has a `game.json`, with that manifest parsed. */
export interface ManifestEntry {
  dir: string;
  manifest: GameManifest;
}

/**
 * Every direct subfolder of `parentDir` that has a `game.json`, parsed, in folder-name order.
 * Folders without one are skipped; a missing `parentDir` gives an empty list.
 *
 * @throws {Error} When a `game.json` that exists can't be read or fails the schema.
 */
export function readManifestsIn(parentDir: string): ManifestEntry[] {
  if (!existsSync(parentDir)) return [];
  return readdirSync(parentDir)
    .sort()
    .map((name) => join(parentDir, name))
    .filter((dir) => existsSync(join(dir, 'game.json')))
    .map((dir) => ({ dir, manifest: readManifest(dir) }));
}
