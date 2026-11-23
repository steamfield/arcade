/**
 * The entry point for the global world art: builds every texture in `keys.ts` from the
 * palette-indexed pixel text in `sprites/`. Boot calls it once. It also exports the two builders
 * a theme uses for its own art (`drawSheets`, `registerLoops`), so every texture in the game is
 * made the same way. Each texture and loop key has one owner (the global art or one theme): the
 * same owner building it again changes nothing, and another owner asking for it throws, so a theme
 * can never draw with someone else's art by reusing a key.
 */
import type Phaser from 'phaser';
import { Frame } from './keys.ts';
import { drawFrames } from './pixel.ts';
import { ART_SHEETS } from './sprites/index.ts';
import type { ArtSheet } from './sprites/sheet.ts';

/** An ambient two-frame loop over frames `a` and `b` of one texture. Cosmetic only: it runs on Phaser's clock, never on logic ticks. */
export interface AnimLoop {
  key: string;
  texture: string;
  frameRate: number;
}

/** The owner name of the global art in `keys.ts`; themes own keys under their theme id. */
export const GLOBAL_ART = 'global';

// Owners per texture and animation manager: both are shared by every scene of one game, and a new game starts clean.
const textureOwners = new WeakMap<object, Map<string, string>>();
const loopOwners = new WeakMap<object, Map<string, string>>();

/**
 * Builds every global texture key; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed (see `drawFrames`), naming the key, frame and row.
 */
export function buildTextures(scene: Phaser.Scene): void {
  drawSheets(scene, ART_SHEETS, GLOBAL_ART);
}

/**
 * Draws each sheet into its texture for `owner`, unless `owner` already drew it.
 *
 * @throws {Error} When another owner already has one of the keys, naming the key and that owner.
 * @throws {Error} When a sprite's pixel text is malformed (see `drawFrames`), naming the key, frame and row.
 */
export function drawSheets(scene: Phaser.Scene, sheets: readonly ArtSheet<string>[], owner: string): void {
  for (const sheet of sheets) {
    if (claim(textureOwners, scene.textures, sheet.key, owner, 'Texture')) drawFrames(scene, sheet.key, sheet.frames);
  }
}

/**
 * Registers each loop for `owner`, unless `owner` already registered it.
 *
 * @throws {Error} When another owner already has one of the loop keys, naming the key and that owner.
 */
export function registerLoops(scene: Phaser.Scene, loops: readonly AnimLoop[], owner: string): void {
  for (const loop of loops) {
    if (!claim(loopOwners, scene.anims, loop.key, owner, 'Animation')) continue;
    scene.anims.create({
      key: loop.key,
      frames: [
        { key: loop.texture, frame: Frame.a },
        { key: loop.texture, frame: Frame.b },
      ],
      frameRate: loop.frameRate,
      repeat: -1,
    });
  }
}

/**
 * Records `owner` for `key` in `manager`'s table. True when the key was free (the caller builds it),
 * false when `owner` already has it.
 *
 * @throws {Error} When another owner has the key.
 */
function claim(
  tables: WeakMap<object, Map<string, string>>,
  manager: object,
  key: string,
  owner: string,
  what: string,
): boolean {
  let owners = tables.get(manager);
  if (!owners) {
    owners = new Map();
    tables.set(manager, owners);
  }
  const current = owners.get(key);
  if (current === owner) return false;
  if (current !== undefined) {
    const holder = current === GLOBAL_ART ? 'the global art' : `theme '${current}'`;
    throw new Error(`${what} '${key}' is owned by ${holder}; give '${owner}' its own key`);
  }
  owners.set(key, owner);
  return true;
}
