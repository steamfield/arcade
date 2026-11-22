/**
 * The race theme, "Reef Rush": G major, 144 BPM, a bright swimming bounce.
 *
 * Form: intro (2 bars, drums and bass) | A (8) | A' (8) | B (8) | turnaround (4), looping
 * from the turnaround back to A.
 *
 * Chords:
 * - intro: G | D
 * - A: G | Bm | C | D | G | Bm | Am D | G (hook, answer, hook, rising resolve)
 * - A': as A, with a higher answer and a climb to B5 at the end
 * - B: Em | C | Am | B | Em | C | F | D (relative minor, a major B and a borrowed F for colour)
 * - turnaround: G | Em | A | D7, ending on the dominant so the loop pulls back to A
 *
 * The hook (A, bars 1-2) is "B A B D~ C B | F#. E D B": a syncopated cell (three eighths, a
 * held note on the off-beat of 2) answered by a leap up a fifth to F#. Pulse 2 plays off-beat
 * stabs in A, thirds under the lead in A' and the turnaround, and a high arpeggio in B while
 * the lead drops an octave into long notes. Drums fill at the end of every section; B is half-time.
 */
import { parseSong, type Song } from '../notation.ts';

/** The race theme in the game's notation. */
export const raceSource = `
name: race
tempo: 144
time: 4/4
loop: A

voice pulse1: duty=0.25 level=0.55 attack=0.005 decay=0.1 sustain=0.6 release=0.06
voice pulse2: duty=0.125 level=0.3 attack=0.005 decay=0.08 sustain=0.45 release=0.04
voice triangle: level=0.7 attack=0.002 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.35 attack=0.001 decay=0.08 sustain=0 release=0.02

section: intro
triangle: [G2/8 G3/8]x4 | [D3/8 D2/8]x3 E2/8 F#2/8
noise: k/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/8 h/8@0.4 | k/8 h/8@0.4 s/8 h/8@0.4 s/16 s/16 s/16 s/16 s/8 s/8

section: A
// hook, answer
pulse1: B4/8 A4/8 B4/8 D5/4 C5/8 B4/4 | F#5/4.v E5/8 D5/4 B4/4 | E5/8 D5/8 E5/8 G5/4 A5/8 G5/4 | F#5/4. E5/8 D5/4 A4/4
// hook, rising resolve
pulse1: B4/8 A4/8 B4/8 D5/4 C5/8 B4/4 | F#5/4.v E5/8 D5/4 B4/4 | A4/8 B4/8 C5/8 D5/4 E5/8 F#5/4 | G5/4. D5/8 G5/4 r/4
pulse2: [r/8 B3/8 r/8 D4/8]x2 | [r/8 D4/8 r/8 F#4/8]x2 | [r/8 E4/8 r/8 G4/8]x2 | [r/8 F#4/8 r/8 A4/8]x2
pulse2: [r/8 B3/8 r/8 D4/8]x2 | [r/8 D4/8 r/8 F#4/8]x2 | r/8 C4/8 r/8 E4/8 r/8 F#4/8 r/8 A4/8 | [r/8 B3/8 r/8 D4/8]x2
triangle: [G2/8 G3/8]x3 G2/8 A2/8 | [B2/8 B3/8]x3 B2/8 D3/8 | [C3/8 C4/8]x3 C3/8 C#3/8 | [D3/8 D4/8]x3 D3/8 F#2/8
triangle: [G2/8 G3/8]x3 G2/8 A2/8 | [B2/8 B3/8]x4 | A2/8 A3/8 A2/8 A3/8 D3/8 D4/8 D3/8 F#2/8 | [G2/8 G3/8]x3 D3/8 F#2/8
noise: [k/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/8 h/8@0.4 |]x7 k/8 h/8@0.4 s/8 h/8@0.4 s/16 s/16 s/16 s/16 s/8 s/8

section: A'
// hook, higher answer
pulse1: B4/8 A4/8 B4/8 D5/4 C5/8 B4/4 | F#5/4.v E5/8 D5/4 B4/4 | E5/8 D5/8 E5/8 G5/4 A5/8 G5/4 | F#5/4. G5/8 A5/4 F#5/4
// hook, climb to the high ending
pulse1: B4/8 A4/8 B4/8 D5/4 C5/8 B4/4 | F#5/4.v E5/8 D5/4 B4/4 | C5/8 D5/8 E5/8 F#5/4 G5/8 A5/4 | B5/4. A5/8 G5/2
pulse2: G4/8 F#4/8 G4/8 B4/4 A4/8 G4/4 | D5/4. C5/8 B4/4 F#4/4 | C5/8 B4/8 C5/8 E5/4 F#5/8 E5/4 | D5/4. E5/8 F#5/4 D5/4
pulse2: G4/8 F#4/8 G4/8 B4/4 A4/8 G4/4 | D5/4. C5/8 B4/4 F#4/4 | A4/8 B4/8 C5/8 D5/4 E5/8 F#5/4 | G5/4. F#5/8 D5/2
triangle: [G2/8 G3/8]x3 G2/8 A2/8 | [B2/8 B3/8]x3 B2/8 D3/8 | [C3/8 C4/8]x3 C3/8 C#3/8 | [D3/8 D4/8]x3 D3/8 F#2/8
triangle: [G2/8 G3/8]x3 G2/8 A2/8 | [B2/8 B3/8]x4 | A2/8 A3/8 A2/8 A3/8 D3/8 D4/8 D3/8 F#2/8 | [G2/8 G3/8]x3 G2/8 F#2/8
noise: [k/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/8 h/8@0.4 |]x7 k/8 h/8@0.4 s/8 h/8@0.4 s/16 s/16 s/16 s/16 s/8 s/8

section: B
// an octave down, long notes
pulse1: G4/4. A4/8 B4/2 | C5/4. B4/8 G4/2 | A4/4. B4/8 C5/4 E5/4 | D#5/2v B4/2
pulse1: G4/4. A4/8 B4/2 | C5/4. D5/8 E5/2 | A4/4. C5/8 F5/2 | F#5/2.v r/4
pulse2: [E5/8 G5/8 B5/8 G5/8]x2 | [E5/8 G5/8 C6/8 G5/8]x2 | [E5/8 A5/8 C6/8 A5/8]x2 | [D#5/8 F#5/8 B5/8 F#5/8]x2
pulse2: [E5/8 G5/8 B5/8 G5/8]x2 | [E5/8 G5/8 C6/8 G5/8]x2 | [F5/8 A5/8 C6/8 A5/8]x2 | [F#5/8 A5/8 D6/8 A5/8]x2
// walking bass
triangle: E2/4 B2/4 E3/4 D3/4 | C3/4 G2/4 C3/4 B2/4 | A2/4 C3/4 E3/4 A#2/4 | B2/4 D#3/4 F#3/4 D#2/4
triangle: E2/4 B2/4 E3/4 D3/4 | C3/4 G2/4 C3/4 E2/4 | F2/4 A2/4 C3/4 C#3/4 | D3/4 A2/4 D3/4 F#2/4
// half-time
noise: [k/4 h/8@0.4 h/8@0.4 s/4 h/8@0.4 k/8 |]x7 k/4 h/8@0.4 h/8@0.4 s/16 s/16 s/16 s/16 s/8 s/8

section: turnaround
pulse1: D5/8 E5/8 D5/8 B4/4 D5/8 G5/4 | E5/8 F#5/8 E5/8 B4/4 E5/8 G5/4 | E5/8 F#5/8 E5/8 C#5/4 E5/8 A5/4 | F#5/4 E5/4 D5/4 C5/4
pulse2: B4/8 C5/8 B4/8 G4/4 B4/8 D5/4 | B4/8 D5/8 B4/8 G4/4 B4/8 E5/4 | C#5/8 D5/8 C#5/8 A4/4 C#5/8 E5/4 | D5/4 C5/4 A4/4 F#4/4
triangle: [G2/8 G3/8]x4 | [E2/8 E3/8]x4 | [A2/8 A3/8]x4 | D3/8 D4/8 D3/8 D4/8 C3/8 B2/8 A2/8 F#2/8
noise: [k/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/8 h/8@0.4 |]x3 k/8 s/16 s/16 k/8 s/16 s/16 s/8 s/8 s/8 s/8
`;

/** The race theme, parsed. */
export const race: Song = parseSong(raceSource);
