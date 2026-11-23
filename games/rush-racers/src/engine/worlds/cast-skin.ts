/**
 * How a world draws and describes its cast: per character slot, the racer texture, the portrait and
 * progress-strip head, and the ability's name and blurb as the select card shows them.
 */
import type { CharacterId } from '../../logic/types.ts';
import type { ArtRef } from './art-ref.ts';

/** An ability as the select card shows it: a name and one short line, both in capitals. */
export interface AbilityText {
  name: string;
  blurb: string;
}

/** A world's cast art and wording, one entry per character slot. */
export interface CastSkin {
  /** Racer texture per slot, with the two stroke frames `Frame.a` and `Frame.b`. */
  racers: Readonly<Record<CharacterId, string>>;
  /** 16x16 portrait per slot. */
  portraits: Readonly<Record<CharacterId, ArtRef>>;
  /** 7x7 progress-strip head per slot. */
  heads: Readonly<Record<CharacterId, ArtRef>>;
  /** The slot's ability as this world words it (Reef's SPRING KICK is Thornwood's SPRING JUMP). */
  abilities: Readonly<Record<CharacterId, AbilityText>>;
}
