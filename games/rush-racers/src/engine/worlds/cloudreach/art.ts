/**
 * Cloudreach's art: `registerArt` draws its cast, items, attacks, pickups, enemies, marks and hazards
 * from the pixel sheets in `sprites/`, and the hazards' loops. `cast.ts` and `objects.ts` name what
 * it draws without importing a sprite.
 */
import type Phaser from 'phaser';
import { drawSheets, registerLoops } from '../../art/index.ts';
import { CLOUDREACH_ART_OWNER } from './keys.ts';
import { SKY_ATTACK_SHEETS } from './sprites/attack.ts';
import { SKY_ENEMY_SHEETS } from './sprites/enemies.ts';
import { SKY_HAZARD_LOOPS, SKY_HAZARD_SHEETS } from './sprites/hazards.ts';
import { SKY_ITEM_SHEETS } from './sprites/items.ts';
import { SKY_MARK_SHEET } from './sprites/marks.ts';
import { SKY_PICKUP_SHEETS } from './sprites/pickups.ts';
import { CLOUDREACH_FACE_SHEETS } from './sprites/portraits.ts';
import { CLOUDREACH_RACER_SHEETS } from './sprites/racers.ts';

/**
 * Draws Cloudreach's racer, portrait and head textures, every object texture and frame the skin
 * names, and the hazards' loops; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerArt(scene: Phaser.Scene): void {
  drawSheets(scene, [...CLOUDREACH_RACER_SHEETS, ...CLOUDREACH_FACE_SHEETS], CLOUDREACH_ART_OWNER);
  drawSheets(
    scene,
    [
      ...SKY_ITEM_SHEETS,
      ...SKY_ATTACK_SHEETS,
      ...SKY_PICKUP_SHEETS,
      ...SKY_ENEMY_SHEETS,
      SKY_MARK_SHEET,
      ...SKY_HAZARD_SHEETS,
    ],
    CLOUDREACH_ART_OWNER,
  );
  registerLoops(scene, SKY_HAZARD_LOOPS, CLOUDREACH_ART_OWNER);
}
