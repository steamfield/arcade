/**
 * Thornwood's cast skin: the land critters' racer textures, portraits, heads and ability wording.
 * `THORNWOOD_CAST` points the skin at the textures `keys.ts` names for the cast, which `art.ts`
 * draws.
 */
import type { CharacterId } from '../../../logic/types.ts';
import type { ArtRef } from '../art-ref.ts';
import type { CastSkin } from '../cast-skin.ts';
import { ThornCastFrame, ThornRacerTex, ThornTex } from './keys.ts';

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
