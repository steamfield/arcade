/**
 * Farside's object skin: items, attacks, the `?` pod and stardust, space enemies, space mines and
 * plasma orbs with their glints, and the words for them. `art.ts` draws every texture the skin
 * names.
 */
import type { PowerUpKind } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import type { ArtRef } from '../art-ref.ts';
import { GLINT_ALPHA, type ObjectSkin } from '../object-skin.ts';
import { FarHazardAnim, FarHazardTex, FarIconFrame, FarItemTex, FarTex } from './keys.ts';

const icon = (kind: PowerUpKind): ArtRef => ({ texture: FarTex.icons, frame: FarIconFrame[kind] });

/** Farside's objects: its own item, attack, pickup, enemy and hazard art and words. Glints have their own keys, because the dark view bakes a glint's colour into the texture under its key. */
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
  hazards: {
    urchin: { texture: FarHazardTex.mine, frame: Frame.a, anim: null },
    jelly: { texture: FarHazardTex.orb, frame: Frame.a, anim: FarHazardAnim.orbPulse },
  },
  glints: {
    urchin: { key: 'farside-glint-urchin', colour: 0xff90b8, alpha: GLINT_ALPHA.urchin },
    jelly: { key: 'farside-glint-jelly', colour: 0xffe070, alpha: GLINT_ALPHA.jelly },
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
