/**
 * Farside's object skin: items, attacks, the `?` pod and stardust, space enemies, hazard glints and
 * the words for them, plus `registerFarsideObjects`, which draws every texture the skin names.
 */
import type Phaser from 'phaser';
import type { PowerUpKind } from '../../../logic/types.ts';
import { drawSheets } from '../../art/index.ts';
import type { ArtRef } from '../art-ref.ts';
import type { ObjectSkin } from '../object-skin.ts';
import { REEF_OBJECTS } from '../reef/objects.ts';
import { FarIconFrame, FarItemTex, FarTex } from './keys.ts';
import { FARSIDE_ART_OWNER } from './owner.ts';
import { ATTACK_ART_SHEETS } from './sprites/attack.ts';
import { FAR_ENEMY_SHEETS } from './sprites/enemies.ts';
import { ITEM_ART_SHEETS } from './sprites/items.ts';
import { FAR_MARK_SHEET } from './sprites/marks.ts';
import { FAR_PICKUP_SHEETS } from './sprites/pickups.ts';

const icon = (kind: PowerUpKind): ArtRef => ({ texture: FarTex.icons, frame: FarIconFrame[kind] });

/** Farside's objects: its own item, attack, pickup and enemy art and words. Glints have their own keys, because the dark view bakes a glint's colour into the texture under its key. */
export const FARSIDE_OBJECTS: ObjectSkin = {
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
  itemTextures: FarItemTex,
  attack: {
    homer: FarTex.probe,
    riptideStreak: FarTex.ionStreak,
    undertowStreak: FarTex.tractorStreak,
    inkCloud: FarTex.gasCloud,
    bubble: FarTex.fieldBubble,
    looseGlow: FarTex.looseGlow,
  },
  pickups: { pearl: FarTex.stardust, clam: FarTex.pod },
  enemies: {
    bodies: { shark: FarTex.ray, eel: FarTex.wormHead, crab: FarTex.mite },
    eelBody: FarTex.wormBody,
    marks: FarTex.marks,
  },
  glints: {
    urchin: { key: 'farside-glint-urchin', colour: 0xff90b8, alpha: REEF_OBJECTS.glints.urchin.alpha },
    jelly: { key: 'farside-glint-jelly', colour: 0xffe070, alpha: REEF_OBJECTS.glints.jelly.alpha },
  },
  text: {
    slowedBy: 'SLOWED BY GAS',
    trapped: 'FIELD',
    attackCaptions: { homingSquid: 'PROBE', riptide: 'ION STREAM', undertow: 'TRACTOR', mimic: 'HOLOGRAM' },
    enemyCaptions: { crab: 'MITE WALKS', shark: 'RAY CHARGES', eel: 'WORM LUNGES' },
    cratesHeading: 'SUPPLY PODS',
    pearlsHeading: 'STARDUST',
  },
};

/**
 * Draws every object texture and frame the skin names, once; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerFarsideObjects(scene: Phaser.Scene): void {
  drawSheets(
    scene,
    [...ITEM_ART_SHEETS, ...ATTACK_ART_SHEETS, ...FAR_PICKUP_SHEETS, ...FAR_ENEMY_SHEETS, FAR_MARK_SHEET],
    FARSIDE_ART_OWNER,
  );
}
