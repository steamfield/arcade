/**
 * Cloudreach's world skin. Until Cloudreach has its own art (phase 3) it draws with Reef's racer and
 * object textures, so only the words here are Cloudreach's. Each string stays within the longest
 * Reef string of the same kind, which is what the select card, HUD and How to Play lay out for.
 */
import type { CastSkin } from './cast-skin.ts';
import type { ObjectSkin } from './object-skin.ts';
import { REEF_CAST } from './reef/cast.ts';
import { REEF_OBJECTS } from './reef/objects.ts';
import type { WorldSkin } from './types.ts';

/** Reef's racers and portraits with Cloudreach's ability wording. */
const CLOUDREACH_CAST: CastSkin = {
  ...REEF_CAST,
  abilities: {
    rudy: { name: 'SHAKE IT OFF', blurb: 'STUNS AND TRAPS END FAST' },
    gil: { name: 'SPRING FLAP', blurb: 'FLAPS LIFT HIGHER' },
    streak: { name: 'WIND-UP', blurb: 'GAINS SPEED ON STRAIGHTS' },
    onyx: { name: 'AMBUSH', blurb: 'REAR BUMPS STEAL SPEED' },
    nib: { name: 'DEEP POCKETS', blurb: 'HOLDS 4 POWER-UPS, NOT 3' },
    baron: { name: 'BULLDOZER', blurb: 'POPS PUFFS, HARD TO BUMP' },
    selene: { name: 'STORM SIGHT', blurb: 'SEES IN STORMS, NO ZAPS' },
    rook: { name: 'FRENZY', blurb: 'SURGES AS RIVALS GET HIT' },
  },
};

/** Reef's object textures with Cloudreach's item, enemy and pickup wording. */
const CLOUDREACH_OBJECTS: ObjectSkin = {
  ...REEF_OBJECTS,
  text: {
    slowedBy: 'SLOWED BY FOG',
    trapped: 'CLOUD',
    attackCaptions: { homingSquid: 'HOMING GULL', riptide: 'JET STREAM', undertow: 'HEADWIND', mimic: 'MIRAGE' },
    enemyCaptions: { crab: 'CLOUD CRAB', shark: 'CROW DIVES', eel: 'EEL LUNGES' },
    cratesHeading: 'BALLOON POP',
    pearlsHeading: 'FEATHERS',
  },
};

/** Cloudreach as the engine draws it. */
export const CLOUDREACH_SKIN: WorldSkin = {
  id: 'cloudreach',
  cast: CLOUDREACH_CAST,
  objects: CLOUDREACH_OBJECTS,
  registerTextures: () => {},
};
