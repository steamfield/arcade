/**
 * Thornwood's art: `registerArt` draws its cast, items, attacks, pickups, enemies, marks and hazards
 * from the pixel sheets in `sprites/`, and the hazards' loops. `cast.ts` and `objects.ts` name what
 * it draws without importing a sprite.
 */
import type Phaser from 'phaser';
import { drawSheets, registerLoops } from '../../art/index.ts';
import { THORNWOOD_ART_OWNER } from './keys.ts';
import { ATTACK_ART_SHEETS } from './sprites/attack.ts';
import { THORN_ENEMY_SHEETS } from './sprites/enemies.ts';
import { THORN_HAZARD_LOOPS, THORN_HAZARD_SHEETS } from './sprites/hazards.ts';
import { ITEM_ART_SHEETS } from './sprites/items.ts';
import { THORN_MARK_SHEET } from './sprites/marks.ts';
import { THORN_PICKUP_SHEETS } from './sprites/pickups.ts';
import { THORNWOOD_FACE_SHEETS } from './sprites/portraits.ts';
import { THORNWOOD_RACER_SHEETS } from './sprites/racers.ts';

/**
 * Draws Thornwood's racer, portrait and head textures, every object texture and frame the skin
 * names, and the hazards' loops; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerArt(scene: Phaser.Scene): void {
  drawSheets(scene, [...THORNWOOD_RACER_SHEETS, ...THORNWOOD_FACE_SHEETS], THORNWOOD_ART_OWNER);
  drawSheets(
    scene,
    [
      ...ITEM_ART_SHEETS,
      ...ATTACK_ART_SHEETS,
      ...THORN_PICKUP_SHEETS,
      ...THORN_ENEMY_SHEETS,
      THORN_MARK_SHEET,
      ...THORN_HAZARD_SHEETS,
    ],
    THORNWOOD_ART_OWNER,
  );
  registerLoops(scene, THORN_HAZARD_LOOPS, THORNWOOD_ART_OWNER);
}
