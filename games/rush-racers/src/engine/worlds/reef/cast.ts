/**
 * Reef's cast skin: the sea creatures' racer textures, portraits, heads and ability wording.
 * `REEF_CAST` points the skin at the textures `keys.ts` names for the cast, which `art.ts` draws.
 */
import type { CharacterId } from '../../../logic/types.ts';
import type { ArtRef } from '../art-ref.ts';
import type { CastSkin } from '../cast-skin.ts';
import { ReefCastFrame, ReefRacerTex, ReefTex } from './keys.ts';

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
