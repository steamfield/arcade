/**
 * Cloudreach's cast skin: the flyers' racer textures, portraits, heads and ability wording.
 * Placeholder art: Reef's textures with Cloudreach's words, until `registerCloudreachCast` draws the
 * textures `keys.ts` names and the skin points at them. Each ability line stays within the longest
 * Reef line of the same kind, which is what the select card lays out for.
 */
import type Phaser from 'phaser';
import type { CastSkin } from '../cast-skin.ts';
import { REEF_CAST } from '../reef/cast.ts';

/** Reef's racers and portraits with Cloudreach's ability wording. */
export const CLOUDREACH_CAST: CastSkin = {
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

/** Builds the cast's textures at boot. Placeholder: Reef's art is already built, so nothing yet. */
export function registerCloudreachCast(_scene: Phaser.Scene): void {}
