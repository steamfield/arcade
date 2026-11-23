/**
 * Cloudreach's object skin: items, attacks, balloon and feather, sky enemies, hazard glints and the
 * words for them. Placeholder art: Reef's textures with Cloudreach's words, until
 * `registerCloudreachObjects` draws the textures `keys.ts` names and the skin points at them. Each
 * string stays within the longest Reef or Thornwood string of the same kind, which is what the HUD
 * and How to Play lay out for, except the attack captions, which the attacks page fits up to 11
 * characters.
 */
import type Phaser from 'phaser';
import type { ObjectSkin } from '../object-skin.ts';
import { REEF_OBJECTS } from '../reef/objects.ts';

/** Reef's object textures with Cloudreach's item, enemy and pickup wording. */
export const CLOUDREACH_OBJECTS: ObjectSkin = {
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

/** Builds the objects' textures at boot. Placeholder: Reef's art is already built, so nothing yet. */
export function registerCloudreachObjects(_scene: Phaser.Scene): void {}
