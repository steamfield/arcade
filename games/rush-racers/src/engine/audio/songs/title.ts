/**
 * The title theme: the race hook at 100 BPM on a rounder 50% pulse, over half-note pads,
 * a root-and-fifth bass and a light hat, so the race theme lands as the payoff.
 *
 * Form: A (8 bars, the race theme's A melody: G | Bm | C | D | G | Bm | Am D | G) then a
 * 4-bar tag (C | D | G | D) that sits on the dominant and loops back to A.
 */
import { parseSong, type Song } from '../notation.ts';

/** The title theme in the game's notation. */
const titleSource = `
name: title
tempo: 100
time: 4/4
loop: A

voice pulse1: duty=0.5 level=0.45 attack=0.01 decay=0.15 sustain=0.5 release=0.12
voice pulse2: duty=0.25 level=0.2 attack=0.03 decay=0.2 sustain=0.5 release=0.15
voice triangle: level=0.6 attack=0.005 decay=0.1 sustain=0.8 release=0.08
voice noise: level=0.2 attack=0.001 decay=0.05 sustain=0 release=0.02

section: A
pulse1: B4/8 A4/8 B4/8 D5/4 C5/8 B4/4 | F#5/4.v E5/8 D5/4 B4/4 | E5/8 D5/8 E5/8 G5/4 A5/8 G5/4 | F#5/4. E5/8 D5/4 A4/4
pulse1: B4/8 A4/8 B4/8 D5/4 C5/8 B4/4 | F#5/4.v E5/8 D5/4 B4/4 | A4/8 B4/8 C5/8 D5/4 E5/8 F#5/4 | G5/4. D5/8 G5/4 r/4
pulse2: B3/2 D4/2 | D4/2 F#4/2 | E4/2 G4/2 | F#4/2 A4/2 | B3/2 D4/2 | D4/2 F#4/2 | C4/2 F#4/2 | B3/2 D4/2
triangle: G2/2 D3/2 | B2/2 F#2/2 | C3/2 G2/2 | D3/2 A2/2 | G2/2 D3/2 | B2/2 F#2/2 | A2/2 D3/2 | G2/2 D3/2
noise: [k/4@0.5 h/4@0.25 r/4 h/4@0.25 |]x8

section: tag
pulse1: G5/2 E5/2 | F#5/2 D5/2 | D5/2 B4/2 | A4/1v
pulse2: E4/2 C4/2 | F#4/2 A4/2 | D4/2 B3/2 | F#4/2 C4/2
triangle: C3/2 G2/2 | D3/2 A2/2 | G2/2 D3/2 | D3/2 A2/2
noise: [k/4@0.5 h/4@0.25 r/4 h/4@0.25 |]x3 k/4@0.5 h/8@0.25 h/8@0.25 h/4@0.3 h/4@0.3
`;

/** The title theme, parsed. */
export const title: Song = parseSong(titleSource);
