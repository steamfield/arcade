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
 * @throws {Error} When the file is missing, or fails the schema (the message names the path).
 * @throws {Error} When the file isn't valid JSON (the message names the path; the parse error is the `cause`).
 */
export function readManifest(gameDir: string): GameManifest {
  const path = join(gameDir, 'game.json');
  const text = readFileSync(path, 'utf8');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`${path} is not valid JSON: ${message}`, { cause });
  }
  return parseManifest(raw, path);
}

/** A folder under `games/` or `templates/` that has a `game.json`, with that manifest parsed. */
export interface ManifestEntry {
  dir: string;
  manifest: GameManifest;
}

/**
 * Every direct subfolder of `parentDir` that has a `game.json`, parsed, in folder-name order.
 * Folders without one are skipped; a missing `parentDir` gives an empty list. When `isWanted` is
 * given, a folder it rejects is skipped before its `game.json` is read, so a broken manifest in an
 * unwanted folder never throws.
 *
 * @throws {Error} When a wanted `game.json` can't be read, isn't valid JSON, or fails the schema.
 */
export function readManifestsIn(parentDir: string, isWanted: (dir: string) => boolean = () => true): ManifestEntry[] {
  if (!existsSync(parentDir)) return [];
  return readdirSync(parentDir)
    .sort()
    .map((name) => join(parentDir, name))
    .filter((dir) => existsSync(join(dir, 'game.json')) && isWanted(dir))
    .map((dir) => ({ dir, manifest: readManifest(dir) }));
}
