/**
 * Reef's art: the pixel sheets for its cast, items, attacks, pickups, enemies, marks and hazards, and
 * `registerArt`, which draws them and the hazards' loops. `cast.ts` and `objects.ts` name what it
 * draws without importing a sprite.
 */
import type Phaser from 'phaser';
import { drawSheets, registerLoops } from '../../art/index.ts';
import type { ArtSheet } from '../../art/sprites/sheet.ts';
import { REEF_ART_OWNER } from './keys.ts';
import { REEF_ATTACK_SHEETS } from './sprites/attack.ts';
import { REEF_ENEMY_SHEETS } from './sprites/enemies.ts';
import { REEF_HAZARD_LOOPS, REEF_HAZARD_SHEETS } from './sprites/hazards.ts';
import { REEF_ITEM_SHEETS } from './sprites/items.ts';
import { REEF_MARK_SHEET } from './sprites/marks.ts';
import { REEF_PICKUP_SHEETS } from './sprites/pickups.ts';
import { REEF_FACE_SHEETS } from './sprites/portraits.ts';
import { REEF_RACER_SHEETS } from './sprites/racers.ts';

/** Every object sheet Reef draws: items, attacks, pickups, enemies, marks and hazards. */
export const REEF_OBJECT_SHEETS: readonly ArtSheet<string>[] = [
  ...REEF_ITEM_SHEETS,
  ...REEF_ATTACK_SHEETS,
  ...REEF_PICKUP_SHEETS,
  ...REEF_ENEMY_SHEETS,
  REEF_MARK_SHEET,
  ...REEF_HAZARD_SHEETS,
];

/**
 * Draws Reef's racer, portrait and head textures, every object texture and frame the skin names,
 * and the hazards' loops; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerArt(scene: Phaser.Scene): void {
  drawSheets(scene, [...REEF_RACER_SHEETS, ...REEF_FACE_SHEETS], REEF_ART_OWNER);
  drawSheets(scene, REEF_OBJECT_SHEETS, REEF_ART_OWNER);
  registerLoops(scene, REEF_HAZARD_LOOPS, REEF_ART_OWNER);
}
