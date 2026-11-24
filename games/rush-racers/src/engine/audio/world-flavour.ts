/**
 * How each world colours the item fire sounds, so one item sounds a little different in every world
 * without a table per world (each skin names its own, `WorldSkin.fireFlavour`): Thornwood's are lower and duller (darker noise), Cloudreach's higher
 * and airier (brighter noise), Farside's square-edged (every tone a square wave). The reef's are the
 * fire sounds as written, and so is any world this file doesn't name, such as one a test registers.
 */
import type { Course } from '../../logic/courses/types.ts';
import { findSkin } from '../worlds/index.ts';
import type { Part } from './sfx.ts';

/** A world's colouring of a sound: a pitch shift, a noise brightness and whether tones go square. */
export interface WorldFlavour {
  /** Semitones every tone moves by. */
  semitones: number;
  /** Multiplier on every noise part's filter frequency: under 1 is duller, over 1 airier. */
  noiseScale: number;
  /** Every tone, triangle or pulse, plays as a 50% square wave. */
  squareTones: boolean;
}

/** The fire sounds as written. */
export const NEUTRAL_FLAVOUR: WorldFlavour = { semitones: 0, noiseScale: 1, squareTones: false };

/** The flavour of the world a course is raced in (`WorldSkin.fireFlavour`); the neutral one for a world without its own. */
export function flavourFor(course: Pick<Course, 'world'>): WorldFlavour {
  return findSkin(course)?.fireFlavour ?? NEUTRAL_FLAVOUR;
}

/** `parts` coloured by `flavour`. Timing and levels never change, so a flavoured sound is as short as its source. */
export function flavourParts(parts: readonly Part[], flavour: WorldFlavour): Part[] {
  return parts.map((part) => {
    if (part.wave === 'noise') {
      return {
        ...part,
        frequency: part.frequency * flavour.noiseScale,
        ...(part.sweepTo !== undefined && { sweepTo: part.sweepTo * flavour.noiseScale }),
      };
    }
    const shifted = { ...part, note: part.note + flavour.semitones };
    return flavour.squareTones ? { ...shifted, wave: 'pulse', duty: 0.5 } : shifted;
  });
}
