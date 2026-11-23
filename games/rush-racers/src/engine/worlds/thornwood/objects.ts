/**
 * Thornwood's object skin: items, attacks, crate and acorn, forest enemies, hazard glints and the
 * words for them. Placeholder art: Reef's textures with Thornwood's words, until
 * `registerThornwoodObjects` draws the textures `keys.ts` names and the skin points at them.
 */
import type Phaser from 'phaser';
import type { ObjectSkin } from '../object-skin.ts';
import { REEF_OBJECTS } from '../reef/objects.ts';

/** Reef's object textures with Thornwood's item, enemy and pickup wording. */
export const THORNWOOD_OBJECTS: ObjectSkin = {
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

/** Builds the objects' textures at boot. Placeholder: Reef's art is already built, so nothing yet. */
export function registerThornwoodObjects(_scene: Phaser.Scene): void {}
