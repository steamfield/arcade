/**
 * Thornwood's cast skin: the land critters' racer textures, portraits, heads and ability wording.
 * Placeholder art: Reef's textures with Thornwood's words, until `registerThornwoodCast` draws the
 * textures `keys.ts` names and the skin points at them.
 */
import type Phaser from 'phaser';
import type { CastSkin } from '../cast-skin.ts';
import { REEF_CAST } from '../reef/cast.ts';

/** Reef's racers and portraits with Thornwood's ability wording. */
export const THORNWOOD_CAST: CastSkin = {
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

/** Builds the cast's textures at boot. Placeholder: Reef's art is already built, so nothing yet. */
export function registerThornwoodCast(_scene: Phaser.Scene): void {}
