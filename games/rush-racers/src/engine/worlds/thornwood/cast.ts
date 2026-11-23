/**
 * Thornwood's cast skin: the land critters' racer textures, portraits, heads and ability wording.
 * `registerThornwoodCast` draws the textures `keys.ts` names for the cast at boot, and
 * `THORNWOOD_CAST` points the skin at them.
 */
import type Phaser from 'phaser';
import type { CharacterId } from '../../../logic/types.ts';
import { drawSheets } from '../../art/index.ts';
import type { ArtRef } from '../art-ref.ts';
import type { CastSkin } from '../cast-skin.ts';
import { ThornCastFrame, ThornRacerTex, ThornTex } from './keys.ts';
import { THORNWOOD_FACE_SHEETS } from './sprites/portraits.ts';
import { THORNWOOD_RACER_SHEETS } from './sprites/racers.ts';

/** The owner name under which Thornwood's textures are drawn; every Thornwood texture shares it. */
const THORNWOOD_OWNER = 'thornwood';

const frameIn =
  (texture: string) =>
  (character: CharacterId): ArtRef => ({ texture, frame: ThornCastFrame[character] });
const portrait = frameIn(ThornTex.portraits);
const head = frameIn(ThornTex.heads);

/** Thornwood's cast, keyed by character slot. */
export const THORNWOOD_CAST: CastSkin = {
  racers: ThornRacerTex,
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

/**
 * Draws the cast's racer, portrait and head textures; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed (see `drawFrames`), naming the key, frame and row.
 * @throws {Error} When another owner already has one of the keys.
 */
export function registerThornwoodCast(scene: Phaser.Scene): void {
  drawSheets(scene, [...THORNWOOD_RACER_SHEETS, ...THORNWOOD_FACE_SHEETS], THORNWOOD_OWNER);
}
