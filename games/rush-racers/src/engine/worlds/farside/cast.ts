/**
 * Farside's cast skin: the space racers' textures, portraits, heads and ability wording.
 * `FARSIDE_CAST` points the skin at the textures `keys.ts` names for the cast, which `art.ts`
 * draws.
 */
import type { CharacterId } from '../../../logic/types.ts';
import type { ArtRef } from '../art-ref.ts';
import type { CastSkin } from '../cast-skin.ts';
import { FarCastFrame, FarRacerTex, FarTex } from './keys.ts';

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
