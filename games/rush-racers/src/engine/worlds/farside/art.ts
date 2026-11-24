/**
 * Farside's art: `registerArt` draws its cast, items, attacks, pickups, enemies, marks and hazards
 * from the pixel sheets in `sprites/`, and the hazards' loops. `cast.ts` and `objects.ts` name what
 * it draws without importing a sprite.
 */
import type Phaser from 'phaser';
import { drawSheets, registerLoops } from '../../art/index.ts';
import { FARSIDE_ART_OWNER } from './keys.ts';
import { ATTACK_ART_SHEETS } from './sprites/attack.ts';
import { FAR_ENEMY_SHEETS } from './sprites/enemies.ts';
import { FAR_HAZARD_LOOPS, FAR_HAZARD_SHEETS } from './sprites/hazards.ts';
import { ITEM_ART_SHEETS } from './sprites/items.ts';
import { FAR_MARK_SHEET } from './sprites/marks.ts';
import { FAR_PICKUP_SHEETS } from './sprites/pickups.ts';
import { FARSIDE_FACE_SHEETS } from './sprites/portraits.ts';
import { FARSIDE_RACER_SHEETS } from './sprites/racers.ts';

/**
 * Draws Farside's racer, portrait and head textures, every object texture and frame the skin names,
 * and the hazards' loops; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerArt(scene: Phaser.Scene): void {
  drawSheets(scene, [...FARSIDE_RACER_SHEETS, ...FARSIDE_FACE_SHEETS], FARSIDE_ART_OWNER);
  drawSheets(
    scene,
    [
      ...ITEM_ART_SHEETS,
      ...ATTACK_ART_SHEETS,
      ...FAR_PICKUP_SHEETS,
      ...FAR_ENEMY_SHEETS,
      FAR_MARK_SHEET,
      ...FAR_HAZARD_SHEETS,
    ],
    FARSIDE_ART_OWNER,
  );
  registerLoops(scene, FAR_HAZARD_LOOPS, FARSIDE_ART_OWNER);
}
