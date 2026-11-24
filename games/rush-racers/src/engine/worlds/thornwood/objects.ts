/**
 * Thornwood's object skin: items, attacks, the `?` crate and acorn, forest enemies, thorn bushes and
 * wasps with their glints, and the words for them, plus `registerThornwoodObjects`, which draws
 * every texture the skin names.
 */
import type Phaser from 'phaser';
import type { PowerUpKind } from '../../../logic/types.ts';
import { drawSheets, registerLoops } from '../../art/index.ts';
import { Frame } from '../../art/keys.ts';
import type { ArtRef } from '../art-ref.ts';
import { GLINT_ALPHA } from '../object-skin.ts';
import type { WorldObjects } from '../types.ts';
import { THORNWOOD_ART_OWNER, ThornIconFrame, ThornItemTex, ThornTex } from './keys.ts';
import { ATTACK_ART_SHEETS } from './sprites/attack.ts';
import { THORN_ENEMY_SHEETS } from './sprites/enemies.ts';
import { THORN_HAZARD_LOOPS, THORN_HAZARD_SHEETS, ThornHazardAnim, ThornHazardTex } from './sprites/hazards.ts';
import { ITEM_ART_SHEETS } from './sprites/items.ts';
import { THORN_MARK_SHEET } from './sprites/marks.ts';
import { THORN_PICKUP_SHEETS } from './sprites/pickups.ts';

const icon = (kind: PowerUpKind): ArtRef => ({ texture: ThornTex.icons, frame: ThornIconFrame[kind] });

/** Thornwood's objects: its own item, attack, pickup and enemy art and words. Glints have their own keys, because the dark view bakes a glint's colour into the texture under its key. */
export const THORNWOOD_OBJECTS: WorldObjects = {
  itemIcons: {
    jetFin: icon('jetFin'),
    bubbleShield: icon('bubbleShield'),
    puffer: icon('puffer'),
    inkSac: icon('inkSac'),
    glowLantern: icon('glowLantern'),
    homingSquid: icon('homingSquid'),
    riptide: icon('riptide'),
    undertow: icon('undertow'),
    mimic: icon('mimic'),
    cannonball: icon('cannonball'),
  },
  itemTextures: ThornItemTex,
  attack: {
    homer: ThornTex.bee,
    riptideStreak: ThornTex.tailwindStreak,
    undertowStreak: ThornTex.snareStreak,
    inkCloud: ThornTex.mudCloud,
    bubble: ThornTex.sapBubble,
    looseGlow: ThornTex.looseGlow,
  },
  pickups: { pearl: ThornTex.acorn, clam: ThornTex.crate },
  enemies: {
    bodies: { shark: ThornTex.boar, eel: ThornTex.snakeHead, crab: ThornTex.beetle },
    eelBody: ThornTex.snakeBody,
    marks: ThornTex.marks,
  },
  hazards: {
    urchin: { texture: ThornHazardTex.thornBush, frame: Frame.a, anim: null },
    jelly: { texture: ThornHazardTex.wasp, frame: Frame.a, anim: ThornHazardAnim.waspBuzz },
  },
  glints: {
    urchin: { key: 'thornwood-glint-urchin', colour: 0xff90b8, alpha: GLINT_ALPHA.urchin },
    jelly: { key: 'thornwood-glint-jelly', colour: 0xffe070, alpha: GLINT_ALPHA.jelly },
  },
  text: {
    slowedBy: 'SLOWED BY MUD',
    trapped: 'SAP',
    attackCaptions: { homingSquid: 'BEE', riptide: 'TAILWIND', undertow: 'SNARE VINE', mimic: 'COPYCAT' },
    enemyCaptions: { crab: 'BEETLE WALKS', shark: 'BOAR CHARGES', eel: 'SNAKE LUNGES' },
    cratesHeading: 'HIT CRATES',
    pearlsHeading: 'GRAB ACORNS',
  },
};

/**
 * Draws every object texture and frame the skin names, and the hazards' loops, once; calling it
 * again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerThornwoodObjects(scene: Phaser.Scene): void {
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
