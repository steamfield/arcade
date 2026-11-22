/**
 * The results loop: 4 gentle bars at 96 BPM (G | Em | C | D) under the results screen. The lead
 * opens with the hook's cell (B A B D) stretched into longer notes over a soft arpeggio, and
 * the last bar sits on D so the loop turns over smoothly.
 */
import { parseSong, type Song } from '../notation.ts';

/** The results loop in the game's notation. */
export const resultsSource = `
name: results
tempo: 96
time: 4/4
loop: loop

voice pulse1: duty=0.5 level=0.4 attack=0.02 decay=0.2 sustain=0.5 release=0.15
voice pulse2: duty=0.125 level=0.2 attack=0.01 decay=0.1 sustain=0.4 release=0.08
voice triangle: level=0.55 attack=0.005 decay=0.1 sustain=0.8 release=0.1
voice noise: level=0.2 attack=0.001 decay=0.05 sustain=0 release=0.02

section: loop
pulse1: B4/4 A4/8 B4/8 D5/2 | E5/4. D5/8 B4/2 | C5/4 E5/4 G5/4 E5/4 | F#5/2 A4/2
pulse2: [G3/8 B3/8 D4/8 B3/8]x2 | [E3/8 G3/8 B3/8 G3/8]x2 | [E3/8 G3/8 C4/8 G3/8]x2 | [F#3/8 A3/8 D4/8 A3/8]x2
triangle: G2/2 D3/2 | E2/2 B2/2 | C3/2 G2/2 | D3/2 A2/2
noise: [k/4@0.35 h/4@0.2 h/4@0.2 h/4@0.2 |]x4
`;

/** The results loop, parsed. */
export const results: Song = parseSong(resultsSource);
