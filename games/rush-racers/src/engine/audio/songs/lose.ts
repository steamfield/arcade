/**
 * The lose jingle, about 2.7 s in 3/4: the hook's cell shape (E D E G) over C, a dip to Eb on
 * the minor iv for a wistful moment, then home to G major, ending on its third (B) so it
 * shrugs rather than mourns. One-shot, no loop.
 */
import { parseSong, type Song } from '../notation.ts';

/** The lose jingle in the game's notation. */
const loseSource = `
name: lose
tempo: 132
time: 3/4

voice pulse1: duty=0.5 level=0.45 attack=0.01 decay=0.15 sustain=0.6 release=0.25
voice pulse2: duty=0.25 level=0.25 attack=0.01 decay=0.15 sustain=0.5 release=0.25
voice triangle: level=0.6 attack=0.005 decay=0.1 sustain=0.8 release=0.15
voice noise: level=0.25 attack=0.001 decay=0.08 sustain=0 release=0.02

pulse1: E5/8 D5/8 E5/8 G5/8 Eb5/4 | D5/4 B4/2v
pulse2: C5/8 B4/8 C5/8 E5/8 C5/4 | B4/4 G4/2
triangle: C3/2 C3/4 | G2/2.
noise: k/4@0.5 r/2 | k/4@0.4 r/2
`;

/** The lose jingle, parsed. */
export const lose: Song = parseSong(loseSource);
