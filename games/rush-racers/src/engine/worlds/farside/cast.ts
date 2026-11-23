/**
 * Farside's cast skin: the land critters' racer textures, portraits, heads and ability wording.
 * `registerFarsideCast` draws the textures `keys.ts` names for the cast at boot, and
 * `FARSIDE_CAST` points the skin at them.
 */
import type Phaser from 'phaser';
import type { CharacterId } from '../../../logic/types.ts';
import { drawSheets } from '../../art/index.ts';
import type { ArtRef } from '../art-ref.ts';
import type { CastSkin } from '../cast-skin.ts';
import { FarCastFrame, FarRacerTex, FarTex } from './keys.ts';
import { FARSIDE_ART_OWNER } from './owner.ts';
import { FARSIDE_FACE_SHEETS } from './sprites/portraits.ts';
import { FARSIDE_RACER_SHEETS } from './sprites/racers.ts';

const frameIn =
  (texture: string) =>
  (character: CharacterId): ArtRef => ({ texture, frame: FarCastFrame[character] });
const portrait = frameIn(FarTex.portraits);
const head = frameIn(FarTex.heads);

/** Farside's cast, keyed by character slot. */
export const FARSIDE_CAST: CastSkin = {
  racers: FarRacerTex,
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
    gil: { name: 'SPRING BURN', blurb: 'DASHES UP OR DOWN HARDER' },
    streak: { name: 'WIND-UP', blurb: 'GAINS SPEED ON STRAIGHTS' },
    onyx: { name: 'AMBUSH', blurb: 'REAR BUMPS STEAL SPEED' },
    nib: { name: 'DEEP POCKETS', blurb: 'HOLDS 4 POWER-UPS, NOT 3' },
    baron: { name: 'BULLDOZER', blurb: 'BREAKS ICE, HARD TO BUMP' },
    selene: { name: 'STARLIGHT', blurb: 'SEES IN SHADOW, NO ORBS' },
    rook: { name: 'FRENZY', blurb: 'SURGES AS RIVALS GET HIT' },
  },
};

/**
 * Draws the cast's racer, portrait and head textures; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed (see `drawFrames`), naming the key, frame and row.
 * @throws {Error} When another owner already has one of the keys.
 */
export function registerFarsideCast(scene: Phaser.Scene): void {
  drawSheets(scene, [...FARSIDE_RACER_SHEETS, ...FARSIDE_FACE_SHEETS], FARSIDE_ART_OWNER);
}
