/**
 * Cloudreach's object skin: items, attacks, the `?` balloon and feather, sky enemies, hazard glints
 * and the words for them, plus `registerCloudreachObjects`, which draws every texture the skin names.
 * Each string stays within the longest Reef or Thornwood string of the same kind, which is what the
 * HUD and How to Play lay out for, except the attack captions, which the attacks page fits up to 11
 * characters.
 */
import type Phaser from 'phaser';
import type { PowerUpKind } from '../../../logic/types.ts';
import { drawSheets } from '../../art/index.ts';
import { SkyHazardPalette } from '../../themes/sky/palettes.ts';
import type { ArtRef } from '../art-ref.ts';
import { GLINT_ALPHA, type ObjectSkin } from '../object-skin.ts';
import { CLOUDREACH_ART_OWNER, SkyIconFrame, SkyItemTex, SkyTex } from './keys.ts';
import { SKY_ATTACK_SHEETS } from './sprites/attack.ts';
import { SKY_ENEMY_SHEETS } from './sprites/enemies.ts';
import { SKY_ITEM_SHEETS } from './sprites/items.ts';
import { SKY_MARK_SHEET } from './sprites/marks.ts';
import { SKY_PICKUP_SHEETS } from './sprites/pickups.ts';

const icon = (kind: PowerUpKind): ArtRef => ({ texture: SkyTex.icons, frame: SkyIconFrame[kind] });

/** The spark cloud's yellow spark, so its glint in a storm cell matches the hazard. */
const SPARK_GLINT_COLOUR = SkyHazardPalette.sparkCloud[2];

/** The static wisp's ice-blue body, so its glint in a storm cell matches the hazard. */
const WISP_GLINT_COLOUR = SkyHazardPalette.staticWisp[1];

/** Cloudreach's objects: its own item, attack, pickup and enemy art and words. Glints have their own keys, because the dark view bakes a glint's colour into the texture under its key. */
export const CLOUDREACH_OBJECTS: ObjectSkin = {
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
  itemTextures: SkyItemTex,
  attack: {
    homer: SkyTex.gull,
    riptideStreak: SkyTex.jetStreamStreak,
    undertowStreak: SkyTex.headwindStreak,
    inkCloud: SkyTex.smokeCloud,
    bubble: SkyTex.cloudBubble,
    looseGlow: SkyTex.looseGlow,
  },
  pickups: { pearl: SkyTex.feather, clam: SkyTex.balloon },
  enemies: {
    bodies: { shark: SkyTex.stormCrow, eel: SkyTex.skyEelHead, crab: SkyTex.cloudCrab },
    eelBody: SkyTex.skyEelBody,
    marks: SkyTex.marks,
  },
  glints: {
    urchin: {
      key: 'cloudreach-glint-spark-cloud',
      colour: SPARK_GLINT_COLOUR,
      alpha: GLINT_ALPHA.urchin,
    },
    jelly: { key: 'cloudreach-glint-static-wisp', colour: WISP_GLINT_COLOUR, alpha: GLINT_ALPHA.jelly },
  },
  text: {
    slowedBy: 'SLOWED BY FOG',
    trapped: 'CLOUD',
    attackCaptions: { homingSquid: 'HOMING GULL', riptide: 'JET STREAM', undertow: 'HEADWIND', mimic: 'MIRAGE' },
    enemyCaptions: { crab: 'CLOUD CRAB', shark: 'CROW DIVES', eel: 'EEL LUNGES' },
    cratesHeading: 'BALLOON POP',
    pearlsHeading: 'FEATHERS',
  },
};

/**
 * Draws every object texture and frame the skin names, once; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerCloudreachObjects(scene: Phaser.Scene): void {
  drawSheets(
    scene,
    [...SKY_ITEM_SHEETS, ...SKY_ATTACK_SHEETS, ...SKY_PICKUP_SHEETS, ...SKY_ENEMY_SHEETS, SKY_MARK_SHEET],
    CLOUDREACH_ART_OWNER,
  );
}
