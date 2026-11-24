/**
 * Reef's object skin: items, attacks, clams and pearls, sea enemies, hazard glints and the words for
 * them, plus `registerReefObjects`, which draws every texture the skin names except the HUD item
 * icons, which are frames of the UI kit's `ui-icons`.
 */
import type Phaser from 'phaser';
import type { PowerUpKind } from '../../../logic/types.ts';
import { drawSheets } from '../../art/index.ts';
import type { ArtSheet } from '../../art/sprites/sheet.ts';
import { IconFrame, UiTex } from '../../art/ui/keys.ts';
import type { ArtRef } from '../art-ref.ts';
import { GLINT_ALPHA, type ObjectSkin } from '../object-skin.ts';
import { REEF_ART_OWNER, ReefItemTex, ReefTex } from './keys.ts';
import { REEF_ATTACK_SHEETS } from './sprites/attack.ts';
import { REEF_ENEMY_SHEETS } from './sprites/enemies.ts';
import { REEF_ITEM_SHEETS } from './sprites/items.ts';
import { REEF_MARK_SHEET } from './sprites/marks.ts';
import { REEF_PICKUP_SHEETS } from './sprites/pickups.ts';

const icon = (kind: PowerUpKind): ArtRef => ({ texture: UiTex.icons, frame: IconFrame[kind] });

/** Reef's objects. */
export const REEF_OBJECTS: ObjectSkin = {
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
  itemTextures: ReefItemTex,
  attack: {
    homer: ReefTex.squid,
    riptideStreak: ReefTex.riptideStreak,
    undertowStreak: ReefTex.undertowStreak,
    inkCloud: ReefTex.inkCloud,
    bubble: ReefTex.bubble,
    looseGlow: ReefTex.looseGlow,
  },
  pickups: { pearl: ReefTex.pearl, clam: ReefTex.clam },
  enemies: {
    bodies: { shark: ReefTex.shark, eel: ReefTex.eelHead, crab: ReefTex.crab },
    eelBody: ReefTex.eelBody,
    marks: ReefTex.marks,
  },
  glints: {
    urchin: { key: 'dark-glint-urchin', colour: 0xff8a7a, alpha: GLINT_ALPHA.urchin },
    jelly: { key: 'dark-glint-jelly', colour: 0xe0b8ff, alpha: GLINT_ALPHA.jelly },
  },
  text: {
    slowedBy: 'SLOWED BY INK',
    trapped: 'BUBBLE',
    attackCaptions: { homingSquid: 'SQUID', riptide: 'RIPTIDE', undertow: 'UNDERTOW', mimic: 'MIMIC' },
    enemyCaptions: { crab: 'CRAB WALKS', shark: 'SHARK CHARGES', eel: 'EEL LUNGES' },
    cratesHeading: 'OPEN CLAMS',
    pearlsHeading: 'GRAB PEARLS',
  },
};

/** Every object sheet Reef draws: items, attacks, pickups, enemies and marks. */
export const REEF_OBJECT_SHEETS: readonly ArtSheet<string>[] = [
  ...REEF_ITEM_SHEETS,
  ...REEF_ATTACK_SHEETS,
  ...REEF_PICKUP_SHEETS,
  ...REEF_ENEMY_SHEETS,
  REEF_MARK_SHEET,
];

/**
 * Draws every object texture and frame the skin names, once; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerReefObjects(scene: Phaser.Scene): void {
  drawSheets(scene, REEF_OBJECT_SHEETS, REEF_ART_OWNER);
}
