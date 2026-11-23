/**
 * Thornwood's object skin: items, attacks, the `?` crate and acorn, forest enemies, hazard glints and
 * the words for them, plus `registerThornwoodObjects`, which draws every texture the skin names.
 */
import type Phaser from 'phaser';
import type { PowerUpKind } from '../../../logic/types.ts';
import { drawSheets } from '../../art/index.ts';
import type { ArtRef } from '../art-ref.ts';
import type { ObjectSkin } from '../object-skin.ts';
import { REEF_OBJECTS } from '../reef/objects.ts';
import { ThornIconFrame, ThornItemTex, ThornTex } from './keys.ts';
import { THORNWOOD_ART_OWNER } from './owner.ts';
import { ATTACK_ART_SHEETS } from './sprites/attack.ts';
import { THORN_ENEMY_SHEETS } from './sprites/enemies.ts';
import { ITEM_ART_SHEETS } from './sprites/items.ts';
import { THORN_MARK_SHEET } from './sprites/marks.ts';
import { THORN_PICKUP_SHEETS } from './sprites/pickups.ts';

const icon = (kind: PowerUpKind): ArtRef => ({ texture: ThornTex.icons, frame: ThornIconFrame[kind] });

/** Thornwood's objects: its own item, attack, pickup and enemy art and words. Glints have their own keys, because the dark view bakes a glint's colour into the texture under its key. */
export const THORNWOOD_OBJECTS: ObjectSkin = {
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
  glints: {
    urchin: { key: 'thornwood-glint-urchin', colour: 0xff90b8, alpha: REEF_OBJECTS.glints.urchin.alpha },
    jelly: { key: 'thornwood-glint-jelly', colour: 0xffe070, alpha: REEF_OBJECTS.glints.jelly.alpha },
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
 * Draws every object texture and frame the skin names, once; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerThornwoodObjects(scene: Phaser.Scene): void {
  drawSheets(
    scene,
    [...ITEM_ART_SHEETS, ...ATTACK_ART_SHEETS, ...THORN_PICKUP_SHEETS, ...THORN_ENEMY_SHEETS, THORN_MARK_SHEET],
    THORNWOOD_ART_OWNER,
  );
}
