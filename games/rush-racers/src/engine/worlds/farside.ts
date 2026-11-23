/**
 * Farside's world skin. Until Farside has its own art it draws with Reef's racer and object
 * textures, so only the words here are Farside's. Each string stays within the longest Reef string
 * of the same kind, which is what the select card, HUD and How to Play lay out for, except the
 * attack captions, which the attacks page fits up to 11 characters.
 */
import type { CastSkin } from './cast-skin.ts';
import type { ObjectSkin } from './object-skin.ts';
import { REEF_CAST } from './reef/cast.ts';
import { REEF_OBJECTS } from './reef/objects.ts';
import type { WorldSkin } from './types.ts';

/** Reef's racers and portraits with Farside's ability wording. */
const FARSIDE_CAST: CastSkin = {
  ...REEF_CAST,
  abilities: {
    rudy: { name: 'SHAKE IT OFF', blurb: 'STUNS AND TRAPS END FAST' },
    gil: { name: 'SPRING BURN', blurb: 'BURNS UP AND DOWN HARDER' },
    streak: { name: 'WIND-UP', blurb: 'GAINS SPEED ON STRAIGHTS' },
    onyx: { name: 'AMBUSH', blurb: 'REAR BUMPS STEAL SPEED' },
    nib: { name: 'DEEP POCKETS', blurb: 'HOLDS 4 POWER-UPS, NOT 3' },
    baron: { name: 'BULLDOZER', blurb: 'BREAKS ICE, HARD TO BUMP' },
    selene: { name: 'STARLIGHT', blurb: 'SEES IN SHADOW, NO ORBS' },
    rook: { name: 'FRENZY', blurb: 'SURGES AS RIVALS GET HIT' },
  },
};

/** Reef's object textures with Farside's item, enemy and pickup wording. */
const FARSIDE_OBJECTS: ObjectSkin = {
  ...REEF_OBJECTS,
  text: {
    slowedBy: 'SLOWED BY GAS',
    trapped: 'FIELD',
    attackCaptions: { homingSquid: 'PROBE', riptide: 'ION STREAM', undertow: 'TRACTOR', mimic: 'HOLOGRAM' },
    enemyCaptions: { crab: 'MITE WALKS', shark: 'RAY CHARGES', eel: 'WORM LUNGES' },
    cratesHeading: 'SUPPLY PODS',
    pearlsHeading: 'STARDUST',
  },
};

/** Farside as the engine draws it. */
export const FARSIDE_SKIN: WorldSkin = {
  id: 'farside',
  cast: FARSIDE_CAST,
  objects: FARSIDE_OBJECTS,
  registerTextures: () => {},
};
