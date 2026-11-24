/**
 * Thornwood's object skin: items, attacks, the `?` crate and acorn, forest enemies, thorn bushes and
 * wasps with their glints, and the words for them. `art.ts` draws every texture the skin names.
 */
import type { PowerUpKind } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import type { ArtRef } from '../art-ref.ts';
import { GLINT_ALPHA, type ObjectSkin } from '../object-skin.ts';
import { ThornHazardAnim, ThornHazardTex, ThornIconFrame, ThornItemTex, ThornTex } from './keys.ts';

const icon = (kind: PowerUpKind): ArtRef => ({ texture: ThornTex.icons, frame: ThornIconFrame[kind] });

/** Thornwood's objects: its own item, attack, pickup, enemy and hazard art and words. Glints have their own keys, because the dark view bakes a glint's colour into the texture under its key. */
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
