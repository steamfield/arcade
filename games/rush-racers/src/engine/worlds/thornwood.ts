/**
 * Thornwood's world skin. Until Thornwood has its own art (phase 3) it draws with Reef's racer and
 * object textures, so only the words here are Thornwood's. Each string stays within the longest
 * Reef string of the same kind, which is what the select card, HUD and How to Play lay out for.
 */

import type { CastSkin } from './cast-skin.ts';
import type { ObjectSkin } from './object-skin.ts';
import { REEF_CAST } from './reef/cast.ts';
import { REEF_OBJECTS } from './reef/objects.ts';
import type { WorldSkin } from './types.ts';

/** Reef's racers and portraits with Thornwood's ability wording. */
const THORNWOOD_CAST: CastSkin = {
  ...REEF_CAST,
  abilities: {
    rudy: { name: 'SHAKE IT OFF', blurb: 'STUNS, SNARES END FAST' },
    gil: { name: 'SPRING JUMP', blurb: 'JUMPS REACH HIGHER' },
    streak: { name: 'WIND-UP', blurb: 'GAINS SPEED ON FLATS' },
    onyx: { name: 'AMBUSH', blurb: 'REAR BUMPS STEAL SPEED' },
    nib: { name: 'DEEP POCKETS', blurb: 'HOLDS 4 POWER-UPS, NOT 3' },
    baron: { name: 'BULLDOZER', blurb: 'RAMS STONE, HARD TO BUMP' },
    selene: { name: 'NIGHT EYES', blurb: 'SEES IN DARK, NO STINGS' },
    rook: { name: 'FRENZY', blurb: 'SURGES AS RIVALS GET HIT' },
  },
};

/** Reef's object textures with Thornwood's item, enemy and pickup wording. */
const THORNWOOD_OBJECTS: ObjectSkin = {
  ...REEF_OBJECTS,
  text: {
    slowedBy: 'SLOWED BY MUD',
    trapped: 'SAP',
    attackCaptions: { homingSquid: 'BEE', riptide: 'TAILWIND', undertow: 'SNARE VINE', mimic: 'COPYCAT' },
    enemyCaptions: { crab: 'BEETLE WALKS', shark: 'BOAR CHARGES', eel: 'SNAKE LUNGES' },
    cratesHeading: 'HIT CRATES',
    pearlsHeading: 'GRAB ACORNS',
  },
};

/** Thornwood as the engine draws it. */
export const THORNWOOD_SKIN: WorldSkin = {
  id: 'thornwood',
  cast: THORNWOOD_CAST,
  objects: THORNWOOD_OBJECTS,
  registerTextures: () => {},
};
