/**
 * Cloudreach's cast skin: the flyers' racer textures, portraits, heads and ability wording.
 * `registerCloudreachCast` draws the textures `keys.ts` names for the cast at boot, and
 * `CLOUDREACH_CAST` points the skin at them. Each ability line stays within the longest Reef line
 * of the same kind, which is what the select card lays out for.
 */
import type Phaser from 'phaser';
import type { CharacterId } from '../../../logic/types.ts';
import { drawSheets } from '../../art/index.ts';
import type { ArtRef } from '../art-ref.ts';
import type { CastSkin } from '../cast-skin.ts';
import { CLOUDREACH_ART_OWNER, SkyPortraitFrame, SkyRacerTex, SkyTex } from './keys.ts';
import { CLOUDREACH_FACE_SHEETS } from './sprites/portraits.ts';
import { CLOUDREACH_RACER_SHEETS } from './sprites/racers.ts';

const frameIn =
  (texture: string) =>
  (character: CharacterId): ArtRef => ({ texture, frame: SkyPortraitFrame[character] });
const portrait = frameIn(SkyTex.portraits);
const head = frameIn(SkyTex.heads);

/** Cloudreach's cast, keyed by character slot. */
export const CLOUDREACH_CAST: CastSkin = {
  racers: SkyRacerTex,
  portraits: {
    rudy: portrait('rudy'),
    gil: portrait('gil'),
    streak: portrait('streak'),
    onyx: portrait('onyx'),
    nib: portrait('nib'),
    baron: portrait('baron'),
    selene: portrait('selene'),
    rook: portrait('rook'),
  },
  heads: {
    rudy: head('rudy'),
    gil: head('gil'),
    streak: head('streak'),
    onyx: head('onyx'),
    nib: head('nib'),
    baron: head('baron'),
    selene: head('selene'),
    rook: head('rook'),
  },
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

/**
 * Draws the cast's racer, portrait and head textures; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed (see `drawFrames`), naming the key, frame and row.
 * @throws {Error} When another owner already has one of the keys.
 */
export function registerCloudreachCast(scene: Phaser.Scene): void {
  drawSheets(scene, [...CLOUDREACH_RACER_SHEETS, ...CLOUDREACH_FACE_SHEETS], CLOUDREACH_ART_OWNER);
}
