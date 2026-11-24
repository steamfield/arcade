/**
 * Reef's cast skin: the sea creatures' racer textures, portraits, heads and ability wording.
 * `registerReefCast` draws the textures `keys.ts` names for the cast at boot, and `REEF_CAST`
 * points the skin at them.
 */
import type Phaser from 'phaser';
import type { CharacterId } from '../../../logic/types.ts';
import { drawSheets } from '../../art/index.ts';
import type { ArtRef } from '../art-ref.ts';
import type { CastSkin } from '../cast-skin.ts';
import { REEF_ART_OWNER, ReefCastFrame, ReefRacerTex, ReefTex } from './keys.ts';
import { REEF_FACE_SHEETS } from './sprites/portraits.ts';
import { REEF_RACER_SHEETS } from './sprites/racers.ts';

const frameIn =
  (texture: string) =>
  (character: CharacterId): ArtRef => ({ texture, frame: ReefCastFrame[character] });
const portrait = frameIn(ReefTex.portraits);
const head = frameIn(ReefTex.heads);

/** Reef's cast, keyed by character slot. */
export const REEF_CAST: CastSkin = {
  racers: ReefRacerTex,
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
    gil: { name: 'SPRING KICK', blurb: 'KICKS PUSH HARDER UPWARD' },
    streak: { name: 'WIND-UP', blurb: 'GAINS SPEED ON STRAIGHTS' },
    onyx: { name: 'AMBUSH', blurb: 'REAR BUMPS STEAL SPEED' },
    nib: { name: 'DEEP POCKETS', blurb: 'HOLDS 4 POWER-UPS, NOT 3' },
    baron: { name: 'BULLDOZER', blurb: 'RAMS CORAL, HARD TO BUMP' },
    selene: { name: 'MOONLIGHT', blurb: 'SEES IN DARK, NO STINGS' },
    rook: { name: 'FRENZY', blurb: 'SURGES AS RIVALS GET HIT' },
  },
};

/**
 * Draws the cast's racer, portrait and head textures; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed (see `drawFrames`), naming the key, frame and row.
 * @throws {Error} When another owner already has one of the keys.
 */
export function registerReefCast(scene: Phaser.Scene): void {
  drawSheets(scene, [...REEF_RACER_SHEETS, ...REEF_FACE_SHEETS], REEF_ART_OWNER);
}
