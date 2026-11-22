/**
 * The win jingle, about 2.7 s: the hook's opening cell (B A B D) climbs over G to D, then a
 * sixteenth-note flourish lands on a long tonic G5 with vibrato. One-shot, no loop.
 */
import { parseSong, type Song } from '../notation.ts';

/** The win jingle in the game's notation. */
export const winSource = `
name: win
tempo: 180
time: 4/4

voice pulse1: duty=0.25 level=0.55 attack=0.005 decay=0.1 sustain=0.7 release=0.2
voice pulse2: duty=0.125 level=0.3 attack=0.005 decay=0.1 sustain=0.6 release=0.2
voice triangle: level=0.7 attack=0.002 decay=0.05 sustain=0.9 release=0.1
voice noise: level=0.35 attack=0.001 decay=0.08 sustain=0 release=0.02

pulse1: B4/8 A4/8 B4/8 D5/4 E5/8 F#5/8 A5/8 | B5/16 A5/16 B5/16 D6/16 G5/2.v
pulse2: G4/8 F#4/8 G4/8 A4/4 C5/8 D5/8 F#5/8 | G5/16 F#5/16 G5/16 B5/16 D5/2.
triangle: G2/4 D3/4 D2/4 F#2/4 | G2/1
noise: k/8 h/8@0.4 s/8 h/8@0.4 k/8 s/8 s/16 s/16 s/8 | k/16 s/16 s/16 s/16 k/4 r/2
`;

/** The win jingle, parsed. */
export const win: Song = parseSong(winSource);
