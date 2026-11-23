/**
 * Reef's object skin: the item icons and art, attack art, clams, pearls, sea enemies, hazard glints
 * and item and enemy words the game has always had.
 */

import type { PowerUpKind } from '../../../logic/types.ts';
import { Tex } from '../../art/keys.ts';
import { IconFrame, UiTex } from '../../art/ui/keys.ts';
import type { ArtRef } from '../art-ref.ts';
import type { ObjectSkin } from '../object-skin.ts';

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
  itemTextures: {
    jetFin: Tex.jetFin,
    bubbleShield: Tex.bubbleShield,
    puffer: Tex.puffer,
    inkSac: Tex.inkSac,
    glowLantern: Tex.glowLantern,
    homingSquid: Tex.homingSquid,
    riptide: Tex.riptide,
    undertow: Tex.undertow,
    mimic: Tex.mimic,
    cannonball: Tex.cannonball,
  },
  attack: {
    homer: Tex.squid,
    riptideStreak: Tex.riptideStreak,
    undertowStreak: Tex.undertowStreak,
    inkCloud: Tex.inkCloud,
    bubble: Tex.bubble,
    looseGlow: Tex.looseGlow,
  },
  pickups: { pearl: Tex.pearl, clam: Tex.clam },
  enemies: {
    bodies: { shark: Tex.shark, eel: Tex.eelHead, crab: Tex.crab },
    eelBody: Tex.eelBody,
    marks: Tex.enemyMark,
  },
  glints: {
    urchin: { key: 'dark-glint-urchin', colour: 0xff8a7a, alpha: 0.55 },
    jelly: { key: 'dark-glint-jelly', colour: 0xe0b8ff, alpha: 0.6 },
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
